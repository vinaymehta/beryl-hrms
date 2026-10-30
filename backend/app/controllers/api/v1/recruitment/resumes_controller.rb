module Api
  module V1
    module Recruitment
      # Extends Mail::BaseController (not the plain BaseController) so
      # import_from_zoho gets the same proactive token refresh
      # and Zoho-error-to-HTTP-status mapping (expired/rate-limited/network)
      # the mail workspace itself relies on, instead of a thinner, duplicated
      # version of that handling.
      class ResumesController < Api::V1::Mail::BaseController
        before_action :set_resume, only: %i[show reprocess download preview destroy]

        # GET /api/v1/recruitment/resumes
        def index
          authorize CandidateResume

          scope = policy_scope(CandidateResume).includes(:candidate, file_attachment: :blob).order(created_at: :desc)

          if params[:status].present? || params[:processingStatus].present?
            st = params[:status] || params[:processingStatus]
            scope = scope.where(processing_status: st)
          else
            # "All Resumes" (no explicit status filter) means all real resumes —
            # repeat submissions of a file already on file stay out unless
            # their dedicated tab asks for them. (Files that aren't resumes
            # aren't kept at all.)
            scope = scope.where.not(processing_status: :duplicate)
          end

          if params[:search].present?
            q = "%#{params[:search].to_s.strip.downcase}%"
            scope = scope.left_joins(:candidate).where(
              "LOWER(candidate_resumes.file_name) LIKE :q OR LOWER(candidates.full_name) LIKE :q OR LOWER(candidates.email) LIKE :q",
              q: q
            )
          end

          # Eligibility verdict — distinct from processing_status above. This is
          # how the Quick Stats cards surface a filtered view now that the full
          # Candidates workspace is hidden. Judged per resume (see the
          # CandidateResume eligibility_* scopes), so a person shortlisted on
          # one resume doesn't drag their other submissions in with them.
          if params[:candidateStatus].present?
            scope = scope.by_eligibility(params[:candidateStatus])
          end

          scope = apply_profile_filters(scope)

          if params[:dateFrom].present?
            scope = scope.where("candidate_resumes.created_at >= ?", Date.parse(params[:dateFrom]).beginning_of_day)
          end
          if params[:dateTo].present?
            scope = scope.where("candidate_resumes.created_at <= ?", Date.parse(params[:dateTo]).end_of_day)
          end

          # .reorder (not .order) — the scope already carries an
          # `.order(created_at: :desc)` from above, which .order would only
          # ever APPEND to, leaving created_at as the primary sort key and
          # silently no-op'ing every one of these picks.
          scope = case params[:sortBy]
          when "criteria_match_desc" then scope.reorder(Arel.sql("candidate_resumes.criteria_match_percentage DESC NULLS LAST"))
          when "criteria_match_asc" then scope.reorder(Arel.sql("candidate_resumes.criteria_match_percentage ASC NULLS LAST"))
          when "ats_score_desc" then scope.reorder(Arel.sql("candidate_resumes.ats_score DESC NULLS LAST"))
          when "ats_score_asc" then scope.reorder(Arel.sql("candidate_resumes.ats_score ASC NULLS LAST"))
          when "status" then scope.reorder(processing_status: :asc, created_at: :desc)
          when "date" then scope.reorder(created_at: :asc)
          else scope
          end

          page = [ params[:page].to_i, 1 ].max
          per_page = 20
          total_count = scope.count
          resumes = scope.offset((page - 1) * per_page).limit(per_page)

          render json: {
            data: resumes.map { |r| resume_summary(r) },
            meta: {
              page: page,
              perPage: per_page,
              totalCount: total_count,
              totalPages: (total_count.to_f / per_page).ceil
            }
          }
        end

        # GET /api/v1/recruitment/resumes/filter_options
        # The choices the Resumes filter panel offers, drawn from the
        # candidates behind this company's resumes only — so every option
        # matches at least one row. Uses the same city/graduation-year
        # expressions #apply_profile_filters filters on, so a picked value
        # always matches what it was read from.
        def filter_options
          authorize CandidateResume, :index?

          candidates = Candidate.where(id: policy_scope(CandidateResume).where.not(candidate_id: nil).select(:candidate_id))

          render json: {
            data: {
              # Case-insensitively de-duplicated: the AI writes "Delhi" on one
              # resume and "delhi" on another.
              cities: candidates.distinct.pluck(Arel.sql(CITY_SQL)).compact.uniq(&:downcase).sort_by(&:downcase),
              roles: candidates.where.not(current_role: [ nil, "" ]).distinct.pluck(:current_role).uniq(&:downcase).sort_by(&:downcase),
              graduationYears: candidates.distinct.pluck(Arel.sql(GRADUATION_YEAR_SQL)).compact.sort.reverse
            }
          }
        end

        # GET /api/v1/recruitment/resumes/:id
        def show
          authorize @resume
          render json: { data: resume_detail(@resume) }
        end

        # POST /api/v1/recruitment/resumes
        def create
          authorize CandidateResume

          file = params[:file]
          unless file.respond_to?(:read)
            render json: { errors: [ { message: "Please provide a valid resume file (PDF or DOCX)" } ] }, status: :unprocessable_entity
            return
          end

          resume = current_company.candidate_resumes.create!(
            file_name: file.original_filename,
            content_type: file.content_type,
            file_size: file.size,
            source: "manual_upload",
            processing_status: :pending
          )

          resume.file.attach(file)
          ResumeProcessingJob.perform_later(resume.id)

          render json: { data: resume_detail(resume) }, status: :created
        end

        # POST /api/v1/recruitment/resumes/:id/reprocess
        def reprocess
          authorize @resume

          @resume.update!(
            processing_status: :pending,
            error_message: nil
          )
          ResumeProcessingJob.perform_later(@resume.id)

          render json: { data: resume_detail(@resume) }
        end

        # GET /api/v1/recruitment/resumes/:id/download — saves the file.
        # Its inline counterpart is #preview below; the two differ only in
        # Content-Disposition and in how the Content-Type is resolved.
        def download
          authorize @resume

          send_resume_file(disposition: "attachment", audit_action: "candidate_resume.downloaded")
        end

        # GET /api/v1/recruitment/resumes/:id/preview — the SAME bytes as
        # #download, served to be rendered in the browser instead of saved.
        # Split from #download because one Content-Disposition cannot serve
        # both: "attachment" always saves, and "inline" on a file the browser
        # can't render also ends up saving it (see #inline_content_type).
        def preview
          authorize @resume, :preview?

          allow_app_framing!
          send_resume_file(disposition: "inline", audit_action: "candidate_resume.previewed")
        end

        # POST /api/v1/recruitment/resumes/import_from_zoho
        def import_from_zoho
          authorize CandidateResume, :create?

          connection = resolve_connection!
          return unless connection

          message_id = params[:messageId] || params[:message_id]
          attachment_id = params[:attachmentId] || params[:attachment_id]
          file_name = params[:fileName] || params[:file_name] || "resume.pdf"
          content_type = params[:contentType] || params[:content_type]

          if SkippedMailAttachment.attachment?(attachment_id)
            render json: { errors: [ { code: "not_a_resume", message: "This attachment was already checked and isn't a resume." } ] },
                   status: :unprocessable_content
            return
          end

          # Check if already imported
          existing = current_company.candidate_resumes.find_by(source_attachment_id: attachment_id)
          if existing
            ResumeProcessingJob.perform_later(existing.id) if existing.failed?
            render json: { data: resume_detail(existing), message: "Resume was already imported" }
            return
          end

          account_id = account_id_for(connection)

          file_data = zoho_client.download_attachment(
            access_token: connection.access_token,
            account_id: account_id,
            message_id: message_id,
            attachment_id: attachment_id
          )

          # The caller's own name over Zoho's bare "attachment" placeholder
          # (see Recruitment::ZohoMailScanner#resume_file_name).
          resume_name = File.extname(file_data[:filename].to_s).present? ? file_data[:filename] : file_name
          reported_type = ::Recruitment::ResumeContentType::GENERIC.include?(file_data[:content_type].to_s) ? content_type : file_data[:content_type]

          resume = current_company.candidate_resumes.create!(
            file_name: resume_name,
            content_type: ::Recruitment::ResumeContentType.resolve(
              filename: resume_name, reported: reported_type, body: file_data[:body]
            ),
            file_size: file_data[:body].bytesize,
            source: "zoho_mail",
            source_email_id: message_id,
            source_attachment_id: attachment_id,
            processing_status: :pending
          )

          resume.file.attach(
            io: StringIO.new(file_data[:body]),
            filename: resume.file_name,
            content_type: resume.content_type
          )

          ResumeProcessingJob.perform_later(resume.id)

          render json: { data: resume_detail(resume) }, status: :created
        end

        # POST /api/v1/recruitment/resumes/scan_zoho_mail
        # Params: connectionIds (array of the mailboxes to scan; each must be
        # one of this user's visible, active connections), from, to
        # (YYYY-MM-DD).
        # Permission-controlled: scans only explicitly chosen, authorized Zoho
        # connections, and only within an HR-selected date range — scanning
        # the whole mailbox is not allowed. This is the on-demand, ad-hoc
        # counterpart to ZohoAutoScanJob and never touches that job's cursor.
        #
        # Each chosen mailbox gets its own ZohoMailboxScanJob, so several
        # mailboxes scan in parallel; this answers straight away with a run
        # id whose progress #scan_zoho_mail_status reports.
        def scan_zoho_mail
          authorize CandidateResume, :create?
          authorize ZohoConnection, :index?

          from_date = parse_scan_date(params[:from])
          to_date = parse_scan_date(params[:to])
          if from_date.nil? || to_date.nil?
            render json: { errors: [ { message: "Please select a date range before scanning." } ] }, status: :unprocessable_entity
            return
          end

          # Snake-cased by config/initializers/json_key_transform.rb. The
          # singular connectionId is the pre-multi-account shape, still
          # accepted so an already-open page keeps working.
          ids = Array(params[:connection_ids].presence || params[:connection_id].presence).map(&:to_s).uniq
          if ids.empty?
            render json: { errors: [ { message: "Choose at least one mail account to scan." } ] }, status: :unprocessable_entity
            return
          end

          connections = policy_scope(ZohoConnection).where(id: ids).order(:id).to_a
          if connections.size != ids.size
            render json: { errors: [ { message: "One of the chosen mail accounts no longer exists." } ] }, status: :not_found
            return
          end

          inactive = connections.reject(&:active?)
          if inactive.any?
            render json: { errors: [ {
              code: "connection_inactive",
              message: "Reconnect #{inactive.map(&:email_address).to_sentence} before scanning."
            } ] }, status: :unprocessable_content
            return
          end

          from = from_date.beginning_of_day
          to = to_date.end_of_day
          scan_id = ::Recruitment::MailScanRun.start!(company: current_company, connections: connections, from: from, to: to)
          ActiveJob.perform_all_later(
            connections.map { |connection| ZohoMailboxScanJob.new(connection.id, from: from, to: to, scan_id: scan_id) }
          )

          render json: { data: ::Recruitment::MailScanRun.fetch(scan_id, company: current_company) }, status: :accepted
        end

        # GET /api/v1/recruitment/resumes/scan_zoho_mail/:scan_id
        # Per-mailbox progress of a manual scan: each account's status
        # (queued/waiting/running/completed/failed) and, once completed, its
        # counts.
        def scan_zoho_mail_status
          authorize CandidateResume, :create?

          run = ::Recruitment::MailScanRun.fetch(params[:scan_id], company: current_company)
          if run.nil?
            render json: { errors: [ { message: "That scan has expired." } ] }, status: :not_found
            return
          end

          render json: { data: run }
        end

        # DELETE /api/v1/recruitment/resumes/:id
        def destroy
          authorize @resume
          @resume.destroy!
          head :no_content
        end

        private

        # The candidate's current city. The AI fills `city` on some resumes
        # and only `current_location` ("Bangalore, Karnataka") on others, so
        # the city part of the location stands in when `city` is blank.
        CITY_SQL = "NULLIF(TRIM(COALESCE(NULLIF(TRIM(candidates.city), ''), " \
                   "SPLIT_PART(candidates.current_location, ',', 1))), '')".freeze

        # candidates.graduation_year is rarely set by extraction; the year the
        # latest structured qualification was completed is where the
        # graduation year actually lives (the eligibility evaluator reads it
        # from there too).
        GRADUATION_YEAR_SQL = "COALESCE(candidates.graduation_year, " \
                              "(SELECT MAX(cq.year_completed) FROM candidate_qualifications cq " \
                              "WHERE cq.candidate_id = candidates.id))".freeze

        # Where the candidate has got to in the interview workflow, read off
        # the interview timestamps rather than the status enum (which a human
        # decision can move independently of them).
        INTERVIEW_STATUS_SQL = {
          "none" => "candidates.interview_at IS NULL AND candidates.feedback_requested_at IS NULL " \
                    "AND candidates.feedback_submitted_at IS NULL",
          "scheduled" => "candidates.interview_at IS NOT NULL AND candidates.feedback_requested_at IS NULL " \
                         "AND candidates.feedback_submitted_at IS NULL",
          "feedback_requested" => "candidates.feedback_requested_at IS NOT NULL AND candidates.feedback_submitted_at IS NULL",
          "feedback_received" => "candidates.feedback_submitted_at IS NOT NULL"
        }.freeze

        # The Resumes filter panel's candidate-profile and score filters. Each
        # is skipped when its param is blank; the candidate ones go through a
        # LEFT JOIN, so a filter on them drops resumes with no candidate yet
        # (still processing) — which can't match a city or a role anyway.
        def apply_profile_filters(scope)
          if params[:city].present?
            scope = scope.left_joins(:candidate).where("LOWER(#{CITY_SQL}) = ?", params[:city].to_s.strip.downcase)
          end

          if params[:currentRole].present?
            scope = scope.left_joins(:candidate).where("LOWER(candidates.current_role) LIKE ?", contains(params[:currentRole]))
          end

          # Either the flattened highest qualification or any structured one
          # (degree + field, so "computer science" finds "B.Tech" + "CSE").
          if params[:qualification].present?
            scope = scope.left_joins(:candidate).where(
              "LOWER(candidates.highest_qualification) LIKE :q OR EXISTS (
                 SELECT 1 FROM candidate_qualifications cq
                 WHERE cq.candidate_id = candidates.id
                   AND LOWER(CONCAT_WS(' ', cq.degree, cq.field_of_study)) LIKE :q)",
              q: contains(params[:qualification])
            )
          end

          if (min = number_param(:experienceMin))
            scope = scope.left_joins(:candidate).where("candidates.experience_years >= ?", min)
          end
          if (max = number_param(:experienceMax))
            scope = scope.left_joins(:candidate).where("candidates.experience_years <= ?", max)
          end

          if (year = number_param(:graduationYear))
            scope = scope.left_joins(:candidate).where("#{GRADUATION_YEAR_SQL} = ?", year.to_i)
          end

          if (condition = INTERVIEW_STATUS_SQL[params[:interviewStatus].to_s])
            scope = scope.left_joins(:candidate).where.not(candidates: { id: nil }).where(condition)
          end

          if (min = number_param(:atsScoreMin))
            scope = scope.where("candidate_resumes.ats_score >= ?", min)
          end
          if (max = number_param(:atsScoreMax))
            scope = scope.where("candidate_resumes.ats_score <= ?", max)
          end
          if (min = number_param(:matchMin))
            scope = scope.where("candidate_resumes.criteria_match_percentage >= ?", min)
          end
          if (max = number_param(:matchMax))
            scope = scope.where("candidate_resumes.criteria_match_percentage <= ?", max)
          end

          scope
        end

        def contains(value)
          "%#{CandidateResume.sanitize_sql_like(value.to_s.strip.downcase)}%"
        end

        # A blank or non-numeric value is "no filter", not an error.
        def number_param(key)
          Float(params[key].to_s.strip)
        rescue ArgumentError
          nil
        end

        def set_resume
          @resume = policy_scope(CandidateResume).find(params[:id])
        end

        # Streamed through this action rather than redirecting to a presigned
        # storage URL. That URL is built from S3_ENDPOINT, which points at
        # storage as the SERVER sees it — on a deployed box that is an
        # internal or loopback address, so the browser followed the redirect
        # to a host it cannot reach and the preview failed. Serving the bytes
        # here keeps it on the already-reachable API origin and needs no extra
        # proxy rules.
        def send_resume_file(disposition:, audit_action:)
          unless @resume.file.attached?
            return render json: { errors: [ { message: "Resume file not found on storage" } ] }, status: :not_found
          end

          ::Audit::Record.call(action: audit_action, auditable: @resume, request: request)

          type = disposition == "inline" ? inline_content_type : @resume.content_type.presence || "application/pdf"

          # A file we can't safely render is sent as a download even on the
          # preview route, rather than inline with a type the browser would
          # either refuse or — worse — execute.
          disposition = "attachment" if type.nil?

          send_data @resume.file.download,
                    filename: @resume.file_name.presence || "resume.pdf",
                    type: type || "application/octet-stream",
                    disposition: disposition
        end

        # The preview is shown in an <iframe>, and every response in this app
        # carries X-Frame-Options: DENY from
        # config/initializers/security_headers.rb — which blocks framing
        # outright, same-origin included, so the modal would render "refused to
        # connect" even once the content type is right. Only THIS response
        # opts out, and only for the app's own origins, via frame-ancestors
        # (the modern replacement for X-Frame-Options; the older header has to
        # be removed as well, since browsers that still honour DENY would
        # otherwise keep blocking). FRONTEND_ORIGINS is the same list CORS and
        # the CSRF origin check already trust.
        def allow_app_framing!
          origins = FrontendOrigins.all

          response.headers.delete("X-Frame-Options")
          response.headers["Content-Security-Policy"] = "frame-ancestors 'self' #{origins.join(' ')}".strip
        end

        # THE reason Preview downloaded instead of rendering in production.
        #
        # Zoho reports application/octet-stream for a large share of genuine
        # PDF attachments, and that is what gets stored on import. Every
        # browser saves an octet-stream body no matter what
        # Content-Disposition says, and `X-Content-Type-Options: nosniff`
        # (config/initializers/security_headers.rb) stops it from correcting
        # the type by sniffing the bytes. Locally uploaded PDFs carry a real
        # application/pdf from the file picker, which is why this only ever
        # showed up on deployed data.
        #
        # So for the inline route the type is resolved from the filename
        # first, and only from the stored type when that is itself one we are
        # willing to render. Anything else returns nil — the caller then
        # serves it as a download. The allowlist is the point: echoing an
        # arbitrary stored content type back inline would let an uploaded
        # text/html "resume" run as script on the API origin.
        INLINE_TYPES_BY_EXTENSION = {
          ".pdf" => "application/pdf",
          ".png" => "image/png",
          ".jpg" => "image/jpeg",
          ".jpeg" => "image/jpeg",
          ".gif" => "image/gif",
          ".webp" => "image/webp",
          ".txt" => "text/plain"
        }.freeze

        def inline_content_type
          from_extension = INLINE_TYPES_BY_EXTENSION[File.extname(@resume.file_name.to_s).downcase]
          return from_extension if from_extension

          stored = @resume.content_type.presence
          INLINE_TYPES_BY_EXTENSION.value?(stored) ? stored : nil
        end

        def parse_scan_date(value)
          return nil if value.blank?
          Date.parse(value.to_s)
        rescue ArgumentError
          nil
        end

        # Same receivedTime (epoch ms) field Zoho::MessagePresenter already
        # relies on for the mail workspace's own date display.
        def resume_summary(r)
          {
            id: r.id.to_s,
            fileName: r.file_name,
            fileSize: r.file_size,
            contentType: r.content_type,
            processingStatus: r.processing_status,
            source: r.source,
            sourceEmailId: r.source_email_id,
            sourceAttachmentId: r.source_attachment_id,
            createdAt: r.created_at.iso8601,
            processedAt: r.processed_at&.iso8601,
            errorMessage: r.error_message,
            candidateId: r.candidate_id&.to_s,
            candidateName: r.candidate&.full_name,
            candidateEmail: r.candidate&.email,
            candidateStatus: r.candidate&.status,
            # A shortlisted candidate with a link out is being waited on, not
            # un-actioned — the list marks them so the two are distinguishable.
            candidateInterviewLinkSentAt: r.candidate&.interview_link_sent_at&.iso8601,
            candidateCity: r.candidate&.city,
            candidateQualification: r.candidate&.highest_qualification,
            candidateExperienceYears: r.candidate&.experience_years&.to_f,
            hasFile: r.file.attached?,
            isCurrent: r.is_current,
            duplicateOfId: r.duplicate_of_id&.to_s,
            isDuplicate: r.processing_status == "duplicate" || r.duplicate_of_id.present?,
            atsScore: r.ats_score,
            criteriaMatchPercentage: r.criteria_match_percentage
          }
        end

        def resume_detail(r)
          resume_summary(r).merge(
            rawText: r.raw_text,
            extractedData: r.extracted_data,
            provenanceData: r.provenance_data,
            aiMetadata: r.ai_metadata,
            fileHash: r.file_hash,
            eligibilityBreakdown: r.eligibility_breakdown,
            candidate: r.candidate ? {
              id: r.candidate.id.to_s,
              fullName: r.candidate.full_name,
              email: r.candidate.email,
              phone: r.candidate.phone,
              city: r.candidate.city,
              currentRole: r.candidate.current_role,
              status: r.candidate.status,
              # Interview stage — the resume panel is the reachable surface for
              # scheduling, so it needs the current interview state inline
              # rather than a second fetch of the candidate.
              interviewAt: r.candidate.interview_at&.iso8601,
              interviewerId: r.candidate.interviewer_id&.to_s,
              interviewerName: r.candidate.interviewer&.full_name,
              feedbackRequestedAt: r.candidate.feedback_requested_at&.iso8601,
              feedbackSubmittedAt: r.candidate.feedback_submitted_at&.iso8601,
              interviewLinkSentAt: r.candidate.interview_link_sent_at&.iso8601,
              duplicateStatus: r.candidate.duplicate_status,
              # The interviewer's write-up, so the panel can show it in full.
              feedback: ::Recruitment::InterviewFeedbackFields.payload(r.candidate)
            } : nil
          )
        end
      end
    end
  end
end

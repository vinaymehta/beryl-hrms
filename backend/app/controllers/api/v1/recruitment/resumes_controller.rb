module Api
  module V1
    module Recruitment
      # Extends Mail::BaseController (not the plain BaseController) so
      # import_from_zoho/scan_zoho_mail get the same proactive token refresh
      # and Zoho-error-to-HTTP-status mapping (expired/rate-limited/network)
      # the mail workspace itself relies on, instead of a thinner, duplicated
      # version of that handling.
      class ResumesController < Api::V1::Mail::BaseController
        before_action :set_resume, only: %i[show reprocess download destroy]

        # GET /api/v1/recruitment/resumes
        def index
          authorize CandidateResume

          scope = policy_scope(CandidateResume).includes(:candidate).order(created_at: :desc)

          if params[:status].present? || params[:processingStatus].present?
            st = params[:status] || params[:processingStatus]
            scope = scope.where(processing_status: st)
          else
            # "All Resumes" (no explicit status filter) means all real resumes —
            # attachments the AI determined aren't resumes, and repeat submissions
            # of a file already on file, stay out unless their dedicated tab
            # explicitly asks for them.
            scope = scope.where.not(processing_status: [:not_a_resume, :duplicate])
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

          page = [params[:page].to_i, 1].max
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
            render json: { errors: [{ message: "Please provide a valid resume file (PDF or DOCX)" }] }, status: :unprocessable_entity
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

        # GET /api/v1/recruitment/resumes/:id/download — mints a short-expiry
        # signed URL fresh on every request rather than streaming the blob
        # through the Rails process, matching DocumentsController#download.
        def download
          authorize @resume

          unless @resume.file.attached?
            return render json: { errors: [{ message: "Resume file not found on storage" }] }, status: :not_found
          end

          ::Audit::Record.call(action: "candidate_resume.downloaded", auditable: @resume, request: request)

          # Streamed through this action rather than redirecting to a
          # presigned storage URL. That URL is built from S3_ENDPOINT, which
          # points at storage as the SERVER sees it — on a deployed box that
          # is an internal or loopback address, so the browser followed the
          # redirect to a host it cannot reach and the PDF preview failed.
          # Serving the bytes here keeps it on the already-reachable API
          # origin and needs no extra proxy rules.
          send_data @resume.file.download,
                    filename: @resume.file_name.presence || "resume.pdf",
                    type: @resume.content_type.presence || "application/pdf",
                    disposition: "inline"
        end

        # POST /api/v1/recruitment/resumes/import_from_zoho
        def import_from_zoho
          authorize CandidateResume, :create?

          connection = resolve_connection!
          return unless connection

          message_id = params[:messageId] || params[:message_id]
          attachment_id = params[:attachmentId] || params[:attachment_id]
          file_name = params[:fileName] || params[:file_name] || "resume.pdf"
          content_type = params[:contentType] || params[:content_type] || "application/pdf"

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

          resume = current_company.candidate_resumes.create!(
            file_name: file_data[:filename] || file_name,
            content_type: file_data[:content_type] || content_type,
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
        # Permission-controlled: scans only the explicitly authorized Zoho
        # connection, and only within an HR-selected date range — scanning
        # the whole mailbox is not allowed. This is the on-demand, ad-hoc
        # counterpart to ZohoAutoScanJob — deliberately separate from it,
        # and never touches that job's cursor. Both share the same
        # underlying inbox walk via Recruitment::ZohoMailScanner.
        def scan_zoho_mail
          authorize CandidateResume, :create?

          from_date = parse_scan_date(params[:from])
          to_date = parse_scan_date(params[:to])
          if from_date.nil? || to_date.nil?
            render json: { errors: [{ message: "Please select a date range before scanning." }] }, status: :unprocessable_entity
            return
          end

          connection = resolve_connection!
          return unless connection

          result = ::Recruitment::ZohoMailScanner.call(
            company: current_company,
            connection: connection,
            account_id: account_id_for(connection),
            from: from_date.beginning_of_day,
            to: to_date.end_of_day,
            zoho_client: zoho_client
          )

          render json: {
            data: {
              scannedMessages: result.scanned_messages,
              detectedResumes: result.detected_resumes,
              skippedDuplicateAttachments: result.skipped_duplicate_attachments,
              skippedNonResumeAttachments: result.skipped_non_resume_attachments
            }
          }
        rescue ::Zoho::TokenExpiredError, ::Zoho::RateLimitedError, ::Zoho::ApiError,
               Faraday::ConnectionFailed, Faraday::TimeoutError, Net::OpenTimeout
          # Let the parent's rescue_from handlers render the proper status/code
          # (401/429/502) instead of masking every Zoho failure as a 422 here.
          raise
        rescue => e
          Rails.logger.error("scan_zoho_mail error: #{e.message}\n#{e.backtrace.take(5).join("\n")}")
          render json: { errors: [{ message: "Failed to scan mailbox: #{e.message}" }] }, status: :unprocessable_entity
        end

        # DELETE /api/v1/recruitment/resumes/:id
        def destroy
          authorize @resume
          @resume.destroy!
          head :no_content
        end

        private

        def set_resume
          @resume = policy_scope(CandidateResume).find(params[:id])
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
              feedbackSubmittedAt: r.candidate.feedback_submitted_at&.iso8601
            } : nil
          )
        end
      end
    end
  end
end

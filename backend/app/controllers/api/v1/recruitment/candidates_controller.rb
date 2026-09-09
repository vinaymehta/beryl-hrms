module Api
  module V1
    module Recruitment
      class CandidatesController < Api::V1::BaseController
        before_action :set_candidate, only: %i[show update destroy shortlist reject status confirm_duplicate dismiss_duplicate]

        # GET /api/v1/recruitment/candidates
        def index
          authorize Candidate

          scope = policy_scope(Candidate).order(created_at: :desc)
          scope = scope.by_city(params[:city]) if params[:city].present?
          scope = scope.by_state(params[:state]) if params[:state].present?
          scope = scope.by_country(params[:country]) if params[:country].present?
          scope = scope.by_qualification(params[:qualification] || params[:degree]) if params[:qualification].present? || params[:degree].present?
          scope = scope.by_min_experience(params[:minExperience]) if params[:minExperience].present?
          scope = scope.by_skill(params[:skill]) if params[:skill].present?
          scope = scope.by_job_title(params[:jobTitle]) if params[:jobTitle].present?
          scope = scope.by_previous_company(params[:previousCompany]) if params[:previousCompany].present?
          scope = scope.by_certification(params[:certification]) if params[:certification].present?
          scope = scope.by_language(params[:language]) if params[:language].present?
          scope = scope.by_processing_status(params[:processingStatus]) if params[:processingStatus].present?
          scope = scope.by_duplicate_status(params[:duplicateStatus]) if params[:duplicateStatus].present?
          scope = scope.where(status: params[:status]) if params[:status].present?

          if params[:search].present?
            q = "%#{params[:search].to_s.strip.downcase}%"
            scope = scope.where(
              "LOWER(full_name) LIKE :q OR LOWER(email) LIKE :q OR LOWER(\"current_role\") LIKE :q OR LOWER(city) LIKE :q",
              q: q
            )
          end

          page = [params[:page].to_i, 1].max
          per_page = 20
          total_count = scope.count
          candidates = scope.offset((page - 1) * per_page).limit(per_page)

          render json: {
            data: candidates.map { |c| candidate_summary(c) },
            meta: {
              page: page,
              perPage: per_page,
              totalCount: total_count,
              totalPages: (total_count.to_f / per_page).ceil
            }
          }
        end

        # GET /api/v1/recruitment/candidates/:id
        def show
          authorize @candidate
          render json: { data: candidate_detail(@candidate) }
        end

        # POST /api/v1/recruitment/candidates
        def create
          authorize Candidate
          candidate = current_company.candidates.new(candidate_params)
          candidate.save!
          render json: { data: candidate_detail(candidate) }, status: :created
        end

        # PATCH /api/v1/recruitment/candidates/:id
        def update
          authorize @candidate
          @candidate.update!(candidate_params)
          render json: { data: candidate_detail(@candidate) }
        end

        # DELETE /api/v1/recruitment/candidates/:id
        def destroy
          authorize @candidate
          @candidate.destroy!
          head :no_content
        end

        # PATCH /api/v1/recruitment/candidates/:id/shortlist
        def shortlist
          authorize @candidate
          @candidate.update!(status: :shortlisted)
          render json: { data: candidate_detail(@candidate) }
        end

        # PATCH /api/v1/recruitment/candidates/:id/reject
        def reject
          authorize @candidate
          @candidate.update!(status: :rejected)
          render json: { data: candidate_detail(@candidate) }
        end

        # PATCH /api/v1/recruitment/candidates/:id/status
        def status
          authorize @candidate
          new_status = params[:status].to_s
          if Candidate.statuses.key?(new_status)
            @candidate.update!(status: new_status)
            render json: { data: candidate_detail(@candidate) }
          else
            render json: { errors: [{ message: "Invalid candidate status: #{new_status}" }] }, status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/recruitment/candidates/:id/confirm_duplicate
        # Human-reviewed confirmation that a flagged candidate is indeed a
        # duplicate — never inferred/actioned automatically (spec: flag for
        # review, never auto-delete suspected duplicates).
        def confirm_duplicate
          authorize @candidate, :update?
          @candidate.update!(duplicate_status: :confirmed_duplicate)
          render json: { data: candidate_detail(@candidate) }
        end

        # PATCH /api/v1/recruitment/candidates/:id/dismiss_duplicate
        # Human-reviewed dismissal — the flagged match was a false positive.
        def dismiss_duplicate
          authorize @candidate, :update?
          @candidate.update!(duplicate_status: :unique_record)
          render json: { data: candidate_detail(@candidate) }
        end

        private

        def set_candidate
          @candidate = policy_scope(Candidate).find(params[:id])
        end

        def candidate_params
          params.permit(
            :first_name, :last_name, :full_name, :email, :phone,
            :city, :state, :country, :current_location, :preferred_location,
            :current_role, :highest_qualification, :experience_years,
            :notice_period, :status, :notes, :industry, languages: []
          )
        end

        def candidate_summary(c)
          latest = c.latest_resume
          {
            id: c.id.to_s,
            fullName: c.full_name,
            email: c.email,
            phone: c.phone,
            city: c.city,
            currentRole: c.current_role,
            highestQualification: c.highest_qualification,
            experienceYears: c.experience_years.to_f,
            status: c.status,
            source: c.source,
            duplicateStatus: c.duplicate_status,
            createdAt: c.created_at.iso8601,
            skills: c.candidate_skills.limit(5).map(&:name),
            hasResume: latest.present?,
            latestResumeId: latest&.id&.to_s
          }
        end

        def candidate_detail(c)
          candidate_summary(c).merge(
            firstName: c.first_name,
            lastName: c.last_name,
            state: c.state,
            country: c.country,
            currentLocation: c.current_location,
            preferredLocation: c.preferred_location,
            noticePeriod: c.notice_period,
            industry: c.industry,
            languages: c.languages,
            notes: c.notes,
            skills: c.candidate_skills.map do |s|
              {
                id: s.id.to_s,
                name: s.name,
                category: s.category,
                confidence: s.confidence,
                provenance: s.provenance
              }
            end,
            qualifications: c.candidate_qualifications.map do |q|
              {
                id: q.id.to_s,
                degree: q.degree,
                fieldOfStudy: q.field_of_study,
                institution: q.institution,
                yearCompleted: q.year_completed,
                confidence: q.confidence,
                provenance: q.provenance
              }
            end,
            experiences: c.candidate_experiences.map do |e|
              {
                id: e.id.to_s,
                jobTitle: e.job_title,
                companyName: e.company_name,
                startDate: e.start_date&.iso8601,
                endDate: e.end_date&.iso8601,
                isCurrent: e.is_current,
                durationMonths: e.duration_months,
                description: e.description,
                confidence: e.confidence,
                provenance: e.provenance
              }
            end,
            certifications: c.candidate_certifications.map do |ct|
              {
                id: ct.id.to_s,
                name: ct.name,
                issuingOrganization: ct.issuing_organization,
                issueDate: ct.issue_date&.iso8601,
                confidence: ct.confidence,
                provenance: ct.provenance
              }
            end,
            resumes: c.candidate_resumes.order(created_at: :desc).map do |r|
              {
                id: r.id.to_s,
                fileName: r.file_name,
                fileSize: r.file_size,
                contentType: r.content_type,
                processingStatus: r.processing_status,
                source: r.source,
                sourceEmailId: r.source_email_id,
                sourceAttachmentId: r.source_attachment_id,
                aiMetadata: r.ai_metadata,
                errorMessage: r.error_message,
                processedAt: r.processed_at&.iso8601,
                createdAt: r.created_at.iso8601,
                hasFile: r.file.attached?
              }
            end
          )
        end
      end
    end
  end
end

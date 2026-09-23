module Api
  module V1
    module Recruitment
      class JobsController < Api::V1::BaseController
        before_action :set_job, only: %i[show update destroy match_candidates update_match]

        # GET /api/v1/recruitment/jobs
        def index
          authorize Job

          scope = policy_scope(Job).includes(:department).order(created_at: :desc)
          scope = scope.where(status: params[:status]) if params[:status].present?

          if params[:search].present?
            q = "%#{params[:search].to_s.strip.downcase}%"
            scope = scope.where("LOWER(title) LIKE :q OR LOWER(description) LIKE :q", q: q)
          end

          render json: {
            data: scope.map { |job| job_summary(job) }
          }
        end

        # GET /api/v1/recruitment/jobs/:id
        def show
          authorize @job
          render json: { data: job_detail(@job) }
        end

        # POST /api/v1/recruitment/jobs
        def create
          authorize Job

          job = current_company.jobs.new(job_params)
          job.save!

          render json: { data: job_detail(job) }, status: :created
        end

        # PATCH /api/v1/recruitment/jobs/:id
        def update
          authorize @job
          @job.update!(job_params)
          render json: { data: job_detail(@job) }
        end

        # DELETE /api/v1/recruitment/jobs/:id
        def destroy
          authorize @job
          @job.destroy!
          head :no_content
        end

        # POST /api/v1/recruitment/jobs/:id/match_candidates
        def match_candidates
          authorize @job, :match_candidates?

          candidates_scope = policy_scope(Candidate)
          if params[:candidateIds].present? || params[:candidate_ids].present?
            ids = params[:candidateIds] || params[:candidate_ids]
            candidates_scope = candidates_scope.where(id: ids)
          end

          candidates = candidates_scope.limit(30)
          matched_count = 0

          candidates.each do |candidate|
            begin
              eval_result = Ai::CandidateMatcher.match(candidate: candidate, job: @job)

              match = current_company.candidate_job_matches.find_or_initialize_by(
                job: @job,
                candidate: candidate
              )

              match.assign_attributes(
                match_score: eval_result[:match_score],
                skills_score: eval_result[:skills_score],
                experience_score: eval_result[:experience_score],
                qualification_score: eval_result[:qualification_score],
                strong_matches: eval_result[:strong_matches],
                potential_gaps: eval_result[:potential_gaps],
                matching_skills: eval_result[:matching_skills],
                missing_skills: eval_result[:missing_skills],
                ai_explanation: eval_result[:ai_explanation],
                ai_metadata: eval_result[:ai_metadata]
              )
              match.save!
              matched_count += 1
            rescue => e
              Rails.logger.error("Failed matching candidate #{candidate.id} against job #{@job.id}: #{e.message}")
            end
          end

          render json: {
            data: job_detail(@job.reload),
            meta: { matchedCandidatesCount: matched_count }
          }
        end

        # PATCH /api/v1/recruitment/jobs/:id/matches/:match_id
        def update_match
          authorize @job, :update?

          match = @job.candidate_job_matches.find(params[:match_id])
          new_status = params[:status].to_s

          if CandidateJobMatch.statuses.key?(new_status)
            match.update!(status: new_status)
            if new_status == "shortlisted"
              match.candidate.update!(status: :shortlisted) if match.candidate.status != "shortlisted"
            end
            render json: { data: serialize_match(match) }
          else
            render json: { errors: [ { message: "Invalid match status: #{new_status}" } ] }, status: :unprocessable_entity
          end
        end

        private

        def set_job
          @job = policy_scope(Job).find(params[:id])
        end

        def job_params
          params.permit(
            :title, :department_id, :min_experience, :description, :status,
            required_skills: [], required_qualifications: []
          )
        end

        def job_summary(job)
          {
            id: job.id.to_s,
            title: job.title,
            departmentId: job.department_id&.to_s,
            departmentName: job.department&.name,
            minExperience: job.min_experience.to_f,
            requiredSkills: Array(job.required_skills),
            requiredQualifications: Array(job.required_qualifications),
            status: job.status,
            description: job.description,
            createdAt: job.created_at.iso8601,
            totalMatchesCount: job.candidate_job_matches.count,
            shortlistedCount: job.candidate_job_matches.where(status: :shortlisted).count
          }
        end

        def job_detail(job)
          matches = job.candidate_job_matches.includes(:candidate).order(match_score: :desc)
          job_summary(job).merge(
            matches: matches.map { |m| serialize_match(m) }
          )
        end

        def serialize_match(m)
          {
            id: m.id.to_s,
            candidateId: m.candidate_id.to_s,
            candidateName: m.candidate&.full_name,
            candidateEmail: m.candidate&.email,
            candidateRole: m.candidate&.current_role,
            candidateCity: m.candidate&.city,
            candidateExperience: m.candidate&.experience_years.to_f,
            candidateStatus: m.candidate&.status,
            matchScore: m.match_score,
            skillsScore: m.skills_score,
            experienceScore: m.experience_score,
            qualificationScore: m.qualification_score,
            strongMatches: Array(m.strong_matches),
            potentialGaps: Array(m.potential_gaps),
            matchingSkills: Array(m.matching_skills),
            missingSkills: Array(m.missing_skills),
            aiExplanation: m.ai_explanation,
            aiMetadata: m.ai_metadata,
            status: m.status,
            updatedAt: m.updated_at.iso8601
          }
        end
      end
    end
  end
end

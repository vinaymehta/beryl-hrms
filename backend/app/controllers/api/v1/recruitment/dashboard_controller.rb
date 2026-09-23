module Api
  module V1
    module Recruitment
      class DashboardController < Api::V1::BaseController
        before_action :authorize_recruitment!

        # GET /api/v1/recruitment/dashboard/stats
        def stats
          candidates = policy_scope(Candidate)
          resumes = policy_scope(CandidateResume)
          # "Real" resumes only — same default scope resumes_controller#index
          # uses (attachments the AI ruled out, and repeat submissions of a
          # file already on file, don't count as resumes here either).
          real_resumes = resumes.where.not(processing_status: [ :not_a_resume, :duplicate ])

          render json: {
            data: {
              totalCandidates: candidates.count,
              newResumes: resumes.where("created_at >= ?", 7.days.ago).count,
              processedResumes: resumes.where(processing_status: :completed).count,
              processingFailures: resumes.where(processing_status: :failed).count,
              shortlistedCandidates: candidates.where(status: :shortlisted).count,
              needsReviewCandidates: candidates.where(status: :needs_review).count,
              # "Hired" — candidates offered a position, whose status changed
              # to offered within the current calendar month. There's no
              # dedicated offered_at timestamp, so updated_at is the closest
              # real proxy available.
              hiredThisMonth: candidates.where(status: :offered)
                                        .where("candidates.updated_at >= ?", Time.current.beginning_of_month)
                                        .count,
              # Recruitment Quick Stats (resume-oriented, per current UI) —
              # each counts real resumes by the resume's OWN deterministic
              # eligibility verdict, sharing the exact scopes the Resumes list
              # filters by so a card's number always matches what clicking it
              # opens.
              totalResumes: real_resumes.count,
              needsReviewResumes: real_resumes.eligibility_needs_review.count,
              shortlistedResumes: real_resumes.eligibility_shortlisted.count,
              rejectedResumes: real_resumes.eligibility_rejected.count,
              # "Other" — attachments the AI determined weren't resumes at
              # all, excluded from every count above; surfaced here so
              # they're not just silently dropped from the Quick Stats.
              otherResumes: resumes.where(processing_status: :not_a_resume).count,
              # Interview stage. Counts every candidate past Shortlisted — not
              # just interview_scheduled — because that's exactly the list the
              # card opens: a candidate stays on it as they move through
              # completed and feedback, rather than vanishing at each step.
              interviewCandidates: candidates.where(status: Candidate::INTERVIEW_WORKFLOW_STATUSES).count
            }
          }
        end

        # GET /api/v1/recruitment/dashboard/analytics
        def analytics
          candidates = policy_scope(Candidate)
          resumes = policy_scope(CandidateResume)

          # Real SQL aggregations
          cities = candidates.where.not(city: [ nil, "" ])
                             .group(:city)
                             .order(Arel.sql("count(*) desc"))
                             .limit(6)
                             .count
                             .map { |k, v| { name: k, count: v } }

          qualifications = candidates.where.not(highest_qualification: [ nil, "" ])
                                     .group(:highest_qualification)
                                     .order(Arel.sql("count(*) desc"))
                                     .limit(6)
                                     .count
                                     .map { |k, v| { name: k, count: v } }

          job_titles = candidates.where.not(current_role: [ nil, "" ])
                                 .group(:current_role)
                                 .order(Arel.sql("count(*) desc"))
                                 .limit(6)
                                 .count
                                 .map { |k, v| { name: k, count: v } }

          # Experience brackets
          experience_brackets = [
            { bracket: "0-2 Years", count: candidates.where("experience_years < 2").count },
            { bracket: "2-5 Years", count: candidates.where("experience_years >= 2 AND experience_years < 5").count },
            { bracket: "5-8 Years", count: candidates.where("experience_years >= 5 AND experience_years < 8").count },
            { bracket: "8+ Years", count: candidates.where("experience_years >= 8").count }
          ]

          # Top skills from candidate_skills
          skills = CandidateSkill.where(company_id: current_company.id)
                                 .group(:name)
                                 .order(Arel.sql("count(*) desc"))
                                 .limit(8)
                                 .count
                                 .map { |k, v| { name: k, count: v } }

          # Pipeline status distribution
          status_dist = candidates.group(:status).count.map do |k, v|
            { status: k, count: v }
          end

          # Resume processing status distribution
          processing_dist = resumes.group(:processing_status).count.map do |k, v|
            { status: k, count: v }
          end

          matches = CandidateJobMatch.where(company_id: current_company.id)
          match_score_distribution = [
            { bracket: "0-40%", count: matches.where("match_score < 40").count },
            { bracket: "40-60%", count: matches.where("match_score >= 40 AND match_score < 60").count },
            { bracket: "60-80%", count: matches.where("match_score >= 60 AND match_score < 80").count },
            { bracket: "80-100%", count: matches.where("match_score >= 80").count }
          ]

          render json: {
            data: {
              candidatesByCity: cities,
              candidatesByQualification: qualifications,
              candidatesByJobTitle: job_titles,
              experienceDistribution: experience_brackets,
              topSkills: skills,
              candidatePipeline: status_dist,
              resumeProcessingStatus: processing_dist,
              matchScoreDistribution: match_score_distribution
            }
          }
        end

        # GET /api/v1/recruitment/dashboard/insights
        def insights
          candidates = policy_scope(Candidate)
          resumes = policy_scope(CandidateResume)

          metrics_summary = {
            total_candidates: candidates.count,
            needs_review: candidates.where(status: :needs_review).count,
            shortlisted: candidates.where(status: :shortlisted).count,
            processed_resumes: resumes.where(processing_status: :completed).count,
            failed_resumes: resumes.where(processing_status: :failed).count,
            top_cities: candidates.where.not(city: nil).group(:city).limit(3).count,
            top_skills: CandidateSkill.where(company_id: current_company.id).group(:name).limit(5).count
          }

          cache_key = "recruitment_ai_insights_#{current_company.id}_#{candidates.maximum(:updated_at).to_i}"
          ai_insights = Rails.cache.fetch(cache_key, expires_in: 1.hour) do
            Ai::DashboardInsights.generate(metrics_summary, company: current_company)
          end

          render json: { data: ai_insights }
        end

        private

        def authorize_recruitment!
          authorize Candidate, :index?
        end
      end
    end
  end
end

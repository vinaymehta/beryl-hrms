module Api
  module V1
    module Recruitment
      class SearchController < Api::V1::BaseController
        # POST /api/v1/recruitment/search/ai
        def ai
          authorize Candidate, :index?

          query = params[:query].to_s.strip
          if query.blank?
            render json: {
              data: {
                interpretation: nil,
                criteria: {},
                candidates: []
              }
            }
            return
          end

          parsed = Ai::SearchParser.parse(query, company: current_company)

          scope = policy_scope(Candidate).order(created_at: :desc)

          scope = scope.by_city(parsed[:city]) if parsed[:city].present?
          scope = scope.by_min_experience(parsed[:minimum_experience_years]) if parsed[:minimum_experience_years].present?

          if parsed[:qualifications].present?
            parsed[:qualifications].each do |q|
              scope = scope.by_qualification(q)
            end
          end

          if parsed[:skills].present?
            # Deterministically match candidates having these skills
            skill_names = parsed[:skills].map { |s| s.strip.downcase }
            scope = scope.joins(:candidate_skills).where("LOWER(candidate_skills.name) IN (?)", skill_names).distinct
          end

          if parsed[:job_title].present?
            # current_role is double-quoted: unquoted it collides with Postgres's
            # reserved CURRENT_ROLE keyword and silently matches nothing real.
            scope = scope.where("LOWER(\"current_role\") LIKE ?", "%#{parsed[:job_title].downcase}%")
          end

          results = scope.limit(50)

          # Fallback if strict intersection yielded no results: search across skills or role
          if results.empty?
            fallback_scope = policy_scope(Candidate)
            if parsed[:skills].present?
              skill_names = parsed[:skills].map { |s| s.strip.downcase }
              fallback_scope = fallback_scope.joins(:candidate_skills).where("LOWER(candidate_skills.name) IN (?)", skill_names).distinct
            elsif parsed[:city].present?
              fallback_scope = fallback_scope.by_city(parsed[:city])
            else
              q = "%#{query.downcase}%"
              fallback_scope = fallback_scope.where("LOWER(full_name) LIKE :q OR LOWER(\"current_role\") LIKE :q", q: q)
            end
            results = fallback_scope.limit(50)
          end

          render json: {
            data: {
              interpretation: parsed[:query_interpretation],
              criteria: {
                city: parsed[:city],
                state: parsed[:state],
                country: parsed[:country],
                skills: parsed[:skills],
                minExperience: parsed[:minimum_experience_years],
                qualifications: parsed[:qualifications],
                jobTitle: parsed[:job_title]
              },
              candidates: results.map { |c| candidate_summary(c) }
            }
          }
        end

        private

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
      end
    end
  end
end

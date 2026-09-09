module Ai
  class CandidateMatcher
    PROMPT_VERSION = "v1".freeze

    def self.match(candidate:, job:, provider: nil)
      new(provider: provider).match(candidate: candidate, job: job)
    end

    def initialize(provider: nil)
      @provider = provider || Ai::Provider.for
    end

    def match(candidate:, job:)
      ActsAsTenant.with_tenant(candidate.company) do
        execute_match(candidate, job)
      end
    end

    private

    def execute_match(candidate, job)
      prompt_template = File.read(Rails.root.join("app/services/ai/prompts/candidate_matcher/#{PROMPT_VERSION}.txt"))

      candidate_summary = build_candidate_summary(candidate)
      job_summary = build_job_summary(job)

      user_prompt = "#{prompt_template}\n\nJOB REQUIREMENTS:\n\"\"\"\n#{job_summary}\n\"\"\"\n\nCANDIDATE PROFILE:\n\"\"\"\n#{candidate_summary}\n\"\"\""

      result = @provider.json_complete(
        prompt: user_prompt,
        system: "You are an ethical AI recruitment matching assistant providing objective decision support. Output valid JSON only.",
        max_tokens: 2048
      )

      metadata = (@provider.respond_to?(:last_metadata) ? @provider.last_metadata : {}).merge(
        prompt_version: PROMPT_VERSION,
        evaluated_at: Time.current.iso8601
      )

      Ai::AuditLogger.record(operation: "candidate_match", status: "success", metadata: metadata, candidate: candidate, job: job)

      {
        match_score: result["match_score"].to_i.clamp(0, 100),
        skills_score: result["skills_score"].to_i.clamp(0, 100),
        experience_score: result["experience_score"].to_i.clamp(0, 100),
        qualification_score: result["qualification_score"].to_i.clamp(0, 100),
        strong_matches: Array(result["strong_matches"]),
        potential_gaps: Array(result["potential_gaps"]),
        matching_skills: Array(result["matching_skills"]),
        missing_skills: Array(result["missing_skills"]),
        ai_explanation: result["ai_explanation"].to_s,
        ai_metadata: metadata
      }
    rescue => e
      Rails.logger.error("Ai::CandidateMatcher error: #{e.message}")
      Ai::AuditLogger.record(operation: "candidate_match", status: "failed", candidate: candidate, job: job, error: e)
      raise
    end

    private

    def build_candidate_summary(candidate)
      skills_list = candidate.candidate_skills.map(&:name).join(", ")
      quals_list = candidate.candidate_qualifications.map { |q| "#{q.degree} (#{q.institution})" }.join(", ")
      exp_list = candidate.candidate_experiences.map { |e| "#{e.job_title} at #{e.company_name} (#{e.duration_months} mos)" }.join("; ")

      <<~TXT
        Name: #{candidate.full_name}
        Current Role: #{candidate.current_role}
        Location: #{[candidate.city, candidate.state, candidate.country].compact.join(", ")}
        Experience Years: #{candidate.experience_years}
        Highest Qualification: #{candidate.highest_qualification}
        Skills: #{skills_list.presence || "None specified"}
        Qualifications: #{quals_list.presence || "None specified"}
        Work Experience: #{exp_list.presence || "None specified"}
      TXT
    end

    def build_job_summary(job)
      <<~TXT
        Job Title: #{job.title}
        Location: #{job.location}
        Required Experience (Years): #{job.min_experience_years}
        Required Skills: #{Array(job.required_skills).join(", ")}
        Required Qualifications: #{Array(job.required_qualifications).join(", ")}
        Description: #{job.description}
      TXT
    end
  end
end

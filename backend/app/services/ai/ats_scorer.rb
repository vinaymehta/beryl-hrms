module Ai
  # Supplementary, display-only resume quality score (0-100) via the generic
  # AI provider abstraction. Deliberately never raises: ATS scoring must never
  # block resume processing or the deterministic eligibility pipeline in
  # Recruitment::EligibilityEvaluator, which alone decides shortlist/needs
  # review. A failure here just leaves ats_score nil.
  class AtsScorer
    PROMPT_VERSION = "v1".freeze

    def self.score(raw_text:, extracted_candidate:, resume: nil, provider: nil)
      new(provider: provider).score(raw_text: raw_text, extracted_candidate: extracted_candidate, resume: resume)
    end

    def initialize(provider: nil)
      @provider = provider || Ai::Provider.for
    end

    def score(raw_text:, extracted_candidate:, resume: nil)
      return nil if raw_text.blank?

      prompt_template = File.read(Rails.root.join("app/services/ai/prompts/ats_scorer/#{PROMPT_VERSION}.txt"))
      profile_summary = build_profile_summary(extracted_candidate)
      user_prompt = "#{prompt_template}\n\nEXTRACTED PROFILE:\n\"\"\"\n#{profile_summary}\n\"\"\"\n\nRESUME TEXT:\n\"\"\"\n#{raw_text.truncate(15000)}\n\"\"\""

      result = @provider.json_complete(
        prompt: user_prompt,
        system: "You are an objective ATS resume quality scorer. Output valid JSON only.",
        max_tokens: 512
      )

      metadata = (@provider.respond_to?(:last_metadata) ? @provider.last_metadata : {}).merge(
        prompt_version: PROMPT_VERSION,
        scored_at: Time.current.iso8601
      )
      Ai::AuditLogger.record(operation: "ats_score", status: "success", metadata: metadata, resume: resume)

      result["ats_score"].to_i.clamp(0, 100)
    rescue => e
      Rails.logger.error("Ai::AtsScorer error: #{e.message}")
      Ai::AuditLogger.record(operation: "ats_score", status: "failed", resume: resume, error: e)
      nil
    end

    private

    def build_profile_summary(candidate_data)
      return "Not available" if candidate_data.blank?

      skills = Array(candidate_data[:skills]).map { |s| s["name"] || s[:name] }.compact.join(", ")
      experiences = Array(candidate_data[:experiences]).map { |e| e["job_title"] || e[:job_title] }.compact.join(", ")

      <<~TXT
        Highest Qualification: #{candidate_data[:highest_qualification]}
        Experience Years: #{candidate_data[:experience_years]}
        Skills: #{skills.presence || "None specified"}
        Roles: #{experiences.presence || "None specified"}
      TXT
    end
  end
end

module Ai
  class ResumeParser
    PROMPT_VERSION = "v4".freeze

    def self.parse(raw_text, resume: nil, provider: nil)
      new(provider: provider).parse(raw_text, resume: resume)
    end

    def initialize(provider: nil)
      @provider = provider || Ai::Provider.for
    end

    def parse(raw_text, resume: nil)
      return empty_result if raw_text.blank?

      prompt_template = File.read(Rails.root.join("app/services/ai/prompts/resume_parser/#{PROMPT_VERSION}.txt"))
      user_prompt = "#{prompt_template}\n\nDOCUMENT TEXT TO ANALYZE:\n\"\"\"\n#{raw_text.truncate(15000)}\n\"\"\""

      result = @provider.json_complete(
        prompt: user_prompt,
        system: "You are an AI resume parser that extracts verified candidate data with strict zero-hallucination compliance. Output valid JSON only.",
        max_tokens: 4096
      )

      metadata = (@provider.respond_to?(:last_metadata) ? @provider.last_metadata : {}).merge(
        prompt_version: PROMPT_VERSION,
        parsed_at: Time.current.iso8601
      )

      Ai::AuditLogger.record(operation: "resume_parse", status: "success", metadata: metadata, resume: resume)
      validate_and_format_result(result, metadata)
    rescue => e
      Rails.logger.error("Ai::ResumeParser error: #{e.message}")
      Ai::AuditLogger.record(operation: "resume_parse", status: "failed", resume: resume, error: e)
      raise
    end

    private

    def validate_and_format_result(result, metadata)
      raw_cand = result["candidate"] || {}

      # Validate minimal fields
      candidate = {
        full_name: extract_scalar(raw_cand["full_name"]),
        first_name: extract_scalar(raw_cand["first_name"]),
        last_name: extract_scalar(raw_cand["last_name"]),
        email: extract_scalar(raw_cand["email"]),
        phone: extract_scalar(raw_cand["phone"]),
        city: extract_scalar(raw_cand["city"]),
        state: extract_scalar(raw_cand["state"]),
        country: extract_scalar(raw_cand["country"]),
        current_location: extract_scalar(raw_cand["current_location"]),
        preferred_location: extract_scalar(raw_cand["preferred_location"]),
        current_role: extract_scalar(raw_cand["current_role"]),
        highest_qualification: extract_scalar(raw_cand["highest_qualification"]),
        experience_years: extract_scalar(raw_cand["experience_years"]),
        notice_period: extract_scalar(raw_cand["notice_period"]),
        industry: extract_scalar(raw_cand["industry"]),
        languages: Array(extract_scalar(raw_cand["languages"])),
        academic_percentage: extract_scalar(raw_cand["academic_percentage"]),
        academic_cgpa: extract_scalar(raw_cand["academic_cgpa"]),
        graduation_year: extract_scalar(raw_cand["graduation_year"]),
        active_backlogs: extract_boolean_scalar(raw_cand["active_backlogs"]),
        skills: Array(raw_cand["skills"]),
        qualifications: Array(raw_cand["qualifications"]),
        experiences: Array(raw_cand["experiences"]),
        certifications: Array(raw_cand["certifications"])
      }

      provenance = {}
      raw_cand.each do |key, val|
        if val.is_a?(Hash) && (val["provenance"].present? || val["confidence"].present?)
          provenance[key] = {
            confidence: val["confidence"],
            provenance: val["provenance"],
            source: val["source"]
          }
        end
      end

      {
        candidate: candidate,
        provenance: provenance,
        ai_summary: result["ai_summary"].to_s,
        is_likely_resume: result.fetch("is_likely_resume", true),
        ai_metadata: metadata
      }
    end

    def extract_scalar(field)
      return nil if field.nil?
      if field.is_a?(Hash)
        val = field["value"]
        val.presence
      else
        field.presence
      end
    end

    # extract_scalar's `.presence` call would silently turn a confirmed
    # `false` into `nil` (ActiveSupport's blank? treats `false` as blank) —
    # fatal for a tri-state field like active_backlogs, where "confirmed no
    # backlogs" (false) must never collapse into "unknown" (nil).
    def extract_boolean_scalar(field)
      return nil if field.nil?
      val = field.is_a?(Hash) ? field["value"] : field
      return nil unless [ true, false ].include?(val)
      val
    end

    def empty_result
      {
        candidate: {},
        provenance: {},
        ai_summary: "",
        is_likely_resume: false,
        ai_metadata: { prompt_version: PROMPT_VERSION }
      }
    end
  end
end

module Ai
  class SearchParser
    PROMPT_VERSION = "v1".freeze

    def self.parse(query_text, company: nil, provider: nil)
      new(provider: provider).parse(query_text, company: company)
    end

    def initialize(provider: nil)
      @provider = provider || Ai::Provider.for
    end

    def parse(query_text, company: nil)
      return empty_result if query_text.blank?

      prompt_template = File.read(Rails.root.join("app/services/ai/prompts/search_parser/#{PROMPT_VERSION}.txt"))
      user_prompt = "#{prompt_template}\n\nUSER SEARCH QUERY:\n\"#{query_text}\""

      result = @provider.json_complete(
        prompt: user_prompt,
        system: "You are a recruitment search query parser that extracts structured database criteria. Output valid JSON only.",
        max_tokens: 1024
      )

      metadata = (@provider.respond_to?(:last_metadata) ? @provider.last_metadata : {}).merge(prompt_version: PROMPT_VERSION)
      Ai::AuditLogger.record(operation: "search_parse", status: "success", metadata: metadata, company: company)

      {
        city: result["city"].presence,
        state: result["state"].presence,
        country: result["country"].presence,
        skills: Array(result["skills"]).map(&:to_s).reject(&:blank?),
        minimum_experience_years: result["minimum_experience_years"]&.to_f,
        qualifications: Array(result["qualifications"]).map(&:to_s).reject(&:blank?),
        job_title: result["job_title"].presence,
        query_interpretation: result["query_interpretation"].to_s
      }
    rescue => e
      Rails.logger.error("Ai::SearchParser error: #{e.message}")
      Ai::AuditLogger.record(operation: "search_parse", status: "failed", company: company, error: e)
      # Fallback deterministic token extraction if AI service encounters network issue
      {
        city: nil,
        state: nil,
        country: nil,
        skills: query_text.scan(/[A-Za-z+#.]{2,}/).take(5),
        minimum_experience_years: nil,
        qualifications: [],
        job_title: nil,
        query_interpretation: "Keyword search: #{query_text}"
      }
    end

    private

    def empty_result
      {
        city: nil,
        state: nil,
        country: nil,
        skills: [],
        minimum_experience_years: nil,
        qualifications: [],
        job_title: nil,
        query_interpretation: ""
      }
    end
  end
end

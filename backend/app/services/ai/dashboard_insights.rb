module Ai
  class DashboardInsights
    PROMPT_VERSION = "v1".freeze

    def self.generate(metrics_summary, company: nil, provider: nil)
      new(provider: provider).generate(metrics_summary, company: company)
    end

    def initialize(provider: nil)
      @provider = provider || Ai::Provider.for
    end

    def generate(metrics_summary, company: nil)
      prompt_template = File.read(Rails.root.join("app/services/ai/prompts/dashboard_insights/#{PROMPT_VERSION}.txt"))
      user_prompt = "#{prompt_template}\n\nAGGREGATED RECRUITMENT DATABASE DATA:\n#{metrics_summary.to_json}"

      result = @provider.json_complete(
        prompt: user_prompt,
        system: "You are a senior recruitment insights analyst. Generate concise executive summaries based strictly on verified metrics. Output valid JSON only.",
        max_tokens: 1536
      )

      metadata = (@provider.respond_to?(:last_metadata) ? @provider.last_metadata : {}).merge(prompt_version: PROMPT_VERSION)
      Ai::AuditLogger.record(operation: "dashboard_insights", status: "success", metadata: metadata, company: company)

      {
        executive_summary: result["executive_summary"].to_s,
        top_strengths: Array(result["top_strengths"]),
        actionable_recommendations: Array(result["actionable_recommendations"]),
        generated_at: Time.current.iso8601
      }
    rescue => e
      Rails.logger.error("Ai::DashboardInsights error: #{e.message}")
      Ai::AuditLogger.record(operation: "dashboard_insights", status: "failed", company: company, error: e)
      {
        executive_summary: "Recruitment dashboard analytics updated with current database figures.",
        top_strengths: [ "Candidate processing pipeline active and operational." ],
        actionable_recommendations: [ "Review new candidates pending human verification." ],
        generated_at: Time.current.iso8601
      }
    end
  end
end

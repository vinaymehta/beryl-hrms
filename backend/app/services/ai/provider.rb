module Ai
  class Error < StandardError; end
  class RateLimitedError < Error; end
  class AuthenticationError < Error; end
  class InvalidResponseError < Error; end

  class Provider
    # Providers with their own wire protocol get a dedicated adapter; every
    # other name (deepseek, openai, groq, mistral, together, openrouter,
    # fireworks, perplexity, ollama, or anything else) is routed through
    # Ai::OpenAiCompatibleProvider, which speaks the OpenAI /chat/completions
    # protocol that virtually every other hosted or self-hosted LLM implements.
    # Switching agents is then just AI_PROVIDER + an API key + AI_MODEL — no
    # code changes.
    ALIASES = { "google" => "gemini" }.freeze

    def self.for(name = nil)
      return Ai::MockProvider.new if Rails.env.test?

      selected = (name || ENV.fetch("AI_PROVIDER", "openai")).to_s.downcase
      selected = ALIASES.fetch(selected, selected)

      provider = build(selected)
      provider.configured? ? provider : Ai::MockProvider.new
    end

    def self.build(selected)
      case selected
      when "gemini"
        Ai::GeminiProvider.new
      when "mock"
        Ai::MockProvider.new
      else
        Ai::OpenAiCompatibleProvider.new(provider: selected)
      end
    end

    # True once the provider has whatever it needs (an API key, at minimum) to
    # make a real call. Provider.for falls back to MockProvider when false, so
    # the app keeps working with fabricated data instead of raising.
    def configured?
      true
    end

    def complete(prompt:, system: nil, max_tokens: 4096, temperature: 0.1)
      raise NotImplementedError, "#{self.class} must implement #complete"
    end

    def json_complete(prompt:, system: nil, max_tokens: 4096, temperature: 0.1)
      raw = complete(prompt: prompt, system: system, max_tokens: max_tokens, temperature: temperature)
      parse_json_response(raw)
    end

    private

    def parse_json_response(raw_text)
      return {} if raw_text.blank?

      # Find JSON block inside markdown code fences ```json ... ``` or raw {...}
      cleaned = raw_text.strip
      if cleaned =~ /```(?:json)?\s*([\s\S]*?)\s*```/
        cleaned = $1.strip
      elsif cleaned =~ /\{[\s\S]*\}/
        cleaned = cleaned[/{[\s\S]*}/]
      end

      JSON.parse(cleaned)
    rescue JSON::ParserError => e
      Rails.logger.error("Failed to parse AI JSON response: #{e.message}\nRaw text was:\n#{raw_text.to_s.truncate(500)}")
      raise InvalidResponseError, "AI response could not be parsed as JSON: #{e.message}"
    end
  end
end

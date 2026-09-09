module Ai
  # Speaks the OpenAI Chat Completions wire protocol (POST {base_url}/chat/completions
  # with a Bearer token) that DeepSeek, OpenAI, Groq, Mistral, Together, OpenRouter,
  # Fireworks, Perplexity, and Ollama (and most other hosted/self-hosted LLM
  # servers) all implement identically. One adapter, selected by AI_PROVIDER,
  # covers all of them — only the base URL and default model differ.
  class OpenAiCompatibleProvider < Provider
    BASE_URLS = {
      "openai" => "https://api.openai.com/v1",
      "deepseek" => "https://api.deepseek.com",
      "groq" => "https://api.groq.com/openai/v1",
      "mistral" => "https://api.mistral.ai/v1",
      "together" => "https://api.together.xyz/v1",
      "openrouter" => "https://openrouter.ai/api/v1",
      "fireworks" => "https://api.fireworks.ai/inference/v1",
      "perplexity" => "https://api.perplexity.ai",
      "ollama" => "http://localhost:11434/v1"
    }.freeze

    DEFAULT_MODELS = {
      "openai" => "gpt-4o-mini",
      "deepseek" => "deepseek-chat",
      "groq" => "llama-3.3-70b-versatile",
      "mistral" => "mistral-large-latest",
      "together" => "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      "openrouter" => "openai/gpt-4o-mini",
      "fireworks" => "accounts/fireworks/models/llama-v3p1-70b-instruct",
      "perplexity" => "sonar",
      "ollama" => "llama3.1"
    }.freeze

    attr_reader :model, :last_metadata

    def initialize(provider:, api_key: nil, model: nil, base_url: nil)
      @provider_name = provider.to_s
      @api_key = api_key.presence || ENV["AI_API_KEY"].presence
      @base_url = (base_url.presence || ENV["AI_BASE_URL"].presence || BASE_URLS[@provider_name])
        &.chomp("/")
      @model = model.presence || ENV["AI_MODEL"].presence || DEFAULT_MODELS[@provider_name] || @provider_name
      @last_metadata = {}
    end

    def configured?
      @api_key.present? && @base_url.present?
    end

    def complete(prompt:, system: nil, max_tokens: 4096, temperature: 0.1)
      raise AuthenticationError, "#{@provider_name} API key is missing. Set AI_API_KEY." if @api_key.blank?
      raise Error, "No API endpoint known for provider '#{@provider_name}'. Set AI_BASE_URL to its OpenAI-compatible endpoint." if @base_url.blank?

      start_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)

      connection = Faraday.new do |f|
        f.options.timeout = 60
        f.options.open_timeout = 10
        f.adapter Faraday.default_adapter
      end

      messages = []
      messages << { role: "system", content: system } if system.present?
      messages << { role: "user", content: prompt }

      payload = {
        model: @model,
        max_tokens: max_tokens,
        temperature: temperature,
        messages: messages
      }

      response = connection.post("#{@base_url}/chat/completions") do |req|
        req.headers["Authorization"] = "Bearer #{@api_key}"
        req.headers["content-type"] = "application/json"
        req.body = payload.to_json
      end

      duration = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start_time) * 1000).round

      handle_response(response, duration)
    end

    private

    def handle_response(response, duration_ms)
      case response.status
      when 200
        body = JSON.parse(response.body)
        text = body.dig("choices", 0, "message", "content").to_s
        usage = body["usage"] || {}

        @last_metadata = {
          provider: @provider_name,
          model: @model,
          duration_ms: duration_ms,
          input_tokens: usage["prompt_tokens"].to_i,
          output_tokens: usage["completion_tokens"].to_i,
          processed_at: Time.current.iso8601
        }

        text
      when 401, 403
        raise AuthenticationError, "#{@provider_name} authentication failed: #{response.body.to_s.truncate(200)}"
      when 429
        raise RateLimitedError, "#{@provider_name} rate limit exceeded. Please retry later."
      else
        raise Error, "#{@provider_name} API error (HTTP #{response.status}): #{response.body.to_s.truncate(200)}"
      end
    end
  end
end

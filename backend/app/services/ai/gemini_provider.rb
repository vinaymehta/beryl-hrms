module Ai
  class GeminiProvider < Provider
    API_BASE = "https://generativelanguage.googleapis.com/v1beta/models".freeze

    attr_reader :model, :last_metadata

    def initialize(api_key: nil, model: nil)
      @api_key = api_key.presence || ENV["AI_API_KEY"].presence
      @model = model.presence || ENV["AI_MODEL"].presence || "gemini-2.0-flash"
      @last_metadata = {}
    end

    def configured?
      @api_key.present?
    end

    def complete(prompt:, system: nil, max_tokens: 4096, temperature: 0.1)
      raise AuthenticationError, "Gemini API key is missing. Set AI_API_KEY." if @api_key.blank?

      start_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)

      connection = Faraday.new do |f|
        f.options.timeout = 60
        f.options.open_timeout = 10
        f.adapter Faraday.default_adapter
      end

      payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: temperature, maxOutputTokens: max_tokens }
      }
      payload[:systemInstruction] = { parts: [{ text: system }] } if system.present?

      response = connection.post("#{API_BASE}/#{@model}:generateContent") do |req|
        req.headers["x-goog-api-key"] = @api_key
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
        text = body.dig("candidates", 0, "content", "parts", 0, "text").to_s
        usage = body["usageMetadata"] || {}

        @last_metadata = {
          provider: "gemini",
          model: @model,
          duration_ms: duration_ms,
          input_tokens: usage["promptTokenCount"].to_i,
          output_tokens: usage["candidatesTokenCount"].to_i,
          processed_at: Time.current.iso8601
        }

        text
      when 401, 403
        raise AuthenticationError, "Gemini authentication failed: #{response.body.to_s.truncate(200)}"
      when 429
        raise RateLimitedError, "Gemini rate limit exceeded. Please retry later."
      else
        raise Error, "Gemini API error (HTTP #{response.status}): #{response.body.to_s.truncate(200)}"
      end
    end
  end
end

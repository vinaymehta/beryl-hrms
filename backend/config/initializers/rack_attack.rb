class Rack::Attack
  # Login-specific throttling is already handled by Rails' built-in
  # `rate_limit` on the sessions/passwords controllers (see
  # docs/ARCHITECTURE.md). This is the broader net: general API abuse across
  # every endpoint, by IP.
  throttle("api/ip", limit: 300, period: 5.minutes) do |req|
    req.ip if req.path.start_with?("/api/")
  end

  self.throttled_responder = lambda do |request|
    [
      429,
      { "Content-Type" => "application/json" },
      [ { errors: [ { code: "rate_limited", message: "Too many requests. Please try again shortly." } ] }.to_json ]
    ]
  end
end

Rack::Attack.cache.store = ActiveSupport::Cache::RedisCacheStore.new(url: ENV.fetch("REDIS_URL", "redis://localhost:6390/0"))

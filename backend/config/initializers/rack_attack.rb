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

# Redis everywhere EXCEPT test. Pointing the test suite at the same Redis as
# the dev server made the throttle counter shared and persistent across runs:
# a suite that legitimately makes a few hundred authenticated requests would
# trip the 300/5min limit and fail unrelated examples with 429s, and running
# the suite twice inside five minutes could fail it outright. An in-memory
# store per test process keeps Rack::Attack exercised while making the suite
# hermetic. (config/environments/test.rb already sets cache_store :null_store
# for the app's own cache; Rack::Attack keeps its own store, hence this line.)
Rack::Attack.cache.store =
  if Rails.env.test?
    ActiveSupport::Cache::MemoryStore.new
  else
    ActiveSupport::Cache::RedisCacheStore.new(url: ENV.fetch("REDIS_URL", "redis://localhost:6390/0"))
  end

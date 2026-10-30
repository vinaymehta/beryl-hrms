class Rack::Attack
  # Login-specific throttling is already handled by Rails' built-in
  # `rate_limit` on the sessions/passwords controllers (see
  # docs/ARCHITECTURE.md). This is the broader net: general API abuse across
  # every endpoint, by IP.
  throttle("api/ip", limit: 300, period: 5.minutes) do |req|
    req.ip if req.path.start_with?("/api/") && !req.path.start_with?("/api/v1/public/")
  end

  # The careers website's read-only feed (Api::V1::Public::*) has its own
  # budget rather than sharing the one above: anyone on the internet can call
  # it, and a website that fetches it server-side sends all its visitors'
  # requests from a single IP, so it is metered per minute on its own terms.
  throttle("public/ip", limit: 120, period: 1.minute) do |req|
    req.ip if req.path.start_with?("/api/v1/public/")
  end

  # Applications from the careers website (Api::V1::Public::
  # JobApplicationsController) arrive from the website's server, so its IP
  # says nothing about who is applying: the server forwards the applicant's
  # own as `applicant_ip`. That value is only trusted alongside a valid API
  # key — otherwise anyone could spend a real applicant's allowance by
  # sending their address — and without one the request IP counts instead.
  CAREERS_APPLICATION_PATH = %r{\A/api/v1/public/job_openings/[^/]+/applications/?\z}

  throttle("careers/applicant", limit: 5, period: 10.minutes) do |req|
    next unless req.post? && req.path.match?(CAREERS_APPLICATION_PATH)

    access = JobApplications::CareersAccess
    forwarded = begin
      req.params["applicant_ip"] if access.valid_token_quietly?(access.token_from(req.get_header("HTTP_AUTHORIZATION")))
    rescue StandardError
      # A malformed body is the controller's to refuse, not this filter's.
      nil
    end
    forwarded.is_a?(String) && forwarded.strip.present? ? "applicant:#{forwarded.strip}" : "ip:#{req.ip}"
  end

  # And a ceiling on everything one caller sends, however it is spread.
  throttle("careers/caller", limit: 60, period: 1.minute) do |req|
    req.ip if req.post? && req.path.match?(CAREERS_APPLICATION_PATH)
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
    ActiveSupport::Cache::RedisCacheStore.new(url: ENV.fetch("REDIS_URL"))
  end

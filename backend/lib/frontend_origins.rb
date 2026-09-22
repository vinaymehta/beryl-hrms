# The one place the deployed frontend's origin is resolved.
#
# It was previously `ENV.fetch("FRONTEND_ORIGINS", "http://localhost:3000")`
# written out in eight places — CORS, CSRF origin checking, three OAuth callback
# redirects, two signed-download origin checks and every mailer link. Eight
# copies of a security-relevant default is eight chances to disagree, and in
# production the fallback was actively harmful:
#
#   • CORS and CSRF would trust http://localhost:3000 — an origin the operator
#     does not control.
#   • Password-reset and appraisal links would be mailed pointing at the
#     RECIPIENT's own machine, which simply fails with nothing in the logs.
#
# So production refuses to guess. Development keeps the convenience, because
# there the fallback is also the truth.
module FrontendOrigins
  # Correct for `npm run dev`, and only ever used outside production.
  DEVELOPMENT_FALLBACK = "http://localhost:3000".freeze

  class MissingConfiguration < StandardError; end

  # Every origin allowed to call the API, in order of preference.
  def self.all
    configured = ENV["FRONTEND_ORIGINS"].to_s.split(",").map(&:strip).reject(&:empty?)
    return configured if configured.any?

    if defined?(Rails) && Rails.env.production?
      raise MissingConfiguration,
            "FRONTEND_ORIGINS is not set. Set it to the public origin(s) of the frontend " \
            "(e.g. https://hrms.example.com) — it drives CORS, CSRF origin checks and every " \
            "link sent by email, and there is no safe default in production."
    end

    [ DEVELOPMENT_FALLBACK ]
  end

  # The canonical one — what links in outgoing mail are built from.
  def self.primary
    all.first
  end

  # Split out for ActionMailer's default_url_options.
  def self.primary_uri
    URI.parse(primary)
  end
end

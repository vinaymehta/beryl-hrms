# Minimal, targeted hardening for a pure JSON API — deliberately not a heavy
# security-headers gem, since the CSP/script-src machinery those are mostly
# built for doesn't apply to an API that never serves HTML.
Rails.application.config.action_dispatch.default_headers.merge!(
  "X-Content-Type-Options" => "nosniff",
  "X-Frame-Options" => "DENY",
  "X-XSS-Protection" => "0"
)

# Only claim HTTPS-only when the deployment actually has TLS. Announcing a
# two-year HSTS policy from a plain-HTTP site is at best ignored (browsers
# disregard the header when it doesn't arrive over TLS) and at worst a trap: a
# client that did honour it would refuse to reach the site at all. Same
# FORCE_SSL switch config/environments/production.rb reads.
if Rails.env.production? && ENV.fetch("FORCE_SSL", "true").downcase != "false"
  Rails.application.config.action_dispatch.default_headers["Strict-Transport-Security"] =
    "max-age=63072000; includeSubDomains"
end

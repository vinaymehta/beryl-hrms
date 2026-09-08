# Minimal, targeted hardening for a pure JSON API — deliberately not a heavy
# security-headers gem, since the CSP/script-src machinery those are mostly
# built for doesn't apply to an API that never serves HTML.
Rails.application.config.action_dispatch.default_headers.merge!(
  "X-Content-Type-Options" => "nosniff",
  "X-Frame-Options" => "DENY",
  "X-XSS-Protection" => "0"
)

if Rails.env.production?
  Rails.application.config.action_dispatch.default_headers["Strict-Transport-Security"] =
    "max-age=63072000; includeSubDomains"
end

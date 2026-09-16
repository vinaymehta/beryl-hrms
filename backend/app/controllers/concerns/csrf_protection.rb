# Double-submit CSRF token: a non-HttpOnly cookie carries a random per-session
# token; the frontend reads it and echoes it back as the X-CSRF-Token header
# on every mutating request. This (rather than Rails' form-oriented
# ActionController::RequestForgeryProtection, which assumes server-rendered
# views) is the standard, framework-agnostic answer for an API + cookie-
# session SPA — see docs/ARCHITECTURE.md.
module CsrfProtection
  extend ActiveSupport::Concern

  CSRF_COOKIE = :csrf_token
  CSRF_HEADER = "X-CSRF-Token"
  SAFE_METHODS = %w[GET HEAD OPTIONS].freeze

  included do
    # Must run before Authentication#require_authentication (defined on the
    # ApplicationController parent, so it would otherwise always run first
    # and halt the chain on a 401 before this ever fires) — prepended so an
    # unauthenticated request still gets a CSRF cookie established on its
    # response, regardless of inheritance order.
    prepend_before_action :ensure_csrf_cookie
    before_action :verify_csrf_token
  end

  private
    # Runs on every request, including unauthenticated GETs — so by the time
    # a visitor's SPA submits its first mutating request (which, uniformly,
    # includes login/register: forcing a victim into an attacker-controlled
    # account is a real, documented CSRF variant, not just a hijack of an
    # existing session), a token cookie already exists to echo back.
    def ensure_csrf_cookie
      rotate_csrf_token if cookies[CSRF_COOKIE].blank?
    end

    def verify_csrf_token
      return unless Rails.application.config.action_controller.allow_forgery_protection
      return if SAFE_METHODS.include?(request.request_method)
      return if valid_csrf_token? && valid_request_origin?

      render json: { errors: [ { code: "invalid_csrf_token", message: "Invalid or missing CSRF token." } ] },
             status: :unprocessable_content
    end

    def valid_csrf_token?
      cookie_token = cookies[CSRF_COOKIE]
      header_token = request.headers[CSRF_HEADER]

      cookie_token.present? && header_token.present? &&
        ActiveSupport::SecurityUtils.secure_compare(cookie_token, header_token)
    end

    # Extra layer alongside the token check itself: reject cross-site
    # mutating requests outright when a browser does send an Origin header.
    # Non-browser API clients (which the CSRF token is not designed to
    # protect against, and which won't have one to begin with) are
    # unaffected.
    def valid_request_origin?
      origin = request.headers["Origin"]
      return true if origin.blank?

      allowed_origins.include?(origin)
    end

    def allowed_origins
      @allowed_origins ||= ENV.fetch("FRONTEND_ORIGINS", "http://localhost:3000").split(",").map(&:strip)
    end

    # Rotate on login so a pre-auth anonymous token never stays valid post-auth.
    def rotate_csrf_token
      cookies[CSRF_COOKIE] = {
        value: SecureRandom.hex(32),
        httponly: false,
        same_site: :lax,
        # Same rule as the session cookie — see the note there. If this one is
        # dropped, every POST/PATCH/DELETE fails the origin check instead.
        secure: request.ssl?
      }
    end
end

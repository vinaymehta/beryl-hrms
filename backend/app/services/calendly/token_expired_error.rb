module Calendly
  # Raised when Calendly rejects the access token. Callers refresh and retry
  # rather than surfacing this — mirrors Zoho::TokenExpiredError.
  class TokenExpiredError < ApiError; end
end

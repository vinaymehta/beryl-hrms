module Calendly
  # Signs the OAuth `state` param so the callback — which Calendly redirects
  # the browser to directly, with no guaranteed session — can resume with the
  # right tenant without trusting anything the client sends. Forging state
  # would otherwise let someone attach their own Calendly account to another
  # company. Same construction as Zoho::ConnectionState, different purpose so
  # the two can never be swapped.
  class ConnectionState
    PURPOSE = :calendly_oauth_state
    EXPIRY = 10.minutes

    def self.encode(company_id:, user_id: nil)
      verifier.generate(
        { company_id: company_id, user_id: user_id, nonce: SecureRandom.hex(8) },
        expires_in: EXPIRY, purpose: PURPOSE
      )
    end

    def self.decode(state)
      return nil if state.blank?

      verifier.verified(state, purpose: PURPOSE)&.with_indifferent_access
    rescue ActiveSupport::MessageVerifier::InvalidSignature
      nil
    end

    def self.verifier
      Rails.application.message_verifier(PURPOSE)
    end
  end
end

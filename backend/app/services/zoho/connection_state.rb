module Zoho
  # Signs/verifies the OAuth `state` param so the callback (unauthenticated
  # — Zoho redirects the browser here directly, there's no session cookie
  # guaranteed relevant at that point) can safely resume with the right
  # tenant/user context without trusting anything the client sends. Rails'
  # own message_verifier, not a bare unsigned value: forging a state value
  # would otherwise let an attacker attach their own Zoho mailbox to
  # someone else's company/user.
  class ConnectionState
    PURPOSE = :zoho_oauth_state
    EXPIRY = 10.minutes

    def self.encode(connection_type:, company_id:, user_id: nil)
      verifier.generate(
        { connection_type: connection_type.to_s, company_id: company_id, user_id: user_id, nonce: SecureRandom.hex(8) },
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

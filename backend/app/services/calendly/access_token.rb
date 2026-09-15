module Calendly
  # Hands back a usable access token for a connection, refreshing first if it is
  # at or near expiry. Kept in one place so every caller refreshes identically
  # and no code path ends up using a token it merely hopes is still valid.
  class AccessToken
    def self.for(connection)
      new(connection).fetch
    end

    def initialize(connection, client: Client.new)
      @connection = connection
      @client = client
    end

    def fetch
      return @connection.access_token unless @connection.token_expired?
      return @connection.access_token if @connection.refresh_token.blank?

      refresh!
    end

    private

      def refresh!
        tokens = @client.refresh_access_token(refresh_token: @connection.refresh_token)
        @connection.update!(
          access_token: tokens[:access_token],
          # Calendly rotates refresh tokens; keep the old one if none came back
          # rather than blanking the only way to refresh again.
          refresh_token: tokens[:refresh_token].presence || @connection.refresh_token,
          token_expires_at: tokens[:expires_in].to_i.seconds.from_now,
          status: :active
        )
        @connection.access_token
      rescue ApiError => e
        # A refresh that fails is not transient — the grant was revoked or the
        # credentials changed. Mark it so the UI can prompt a reconnect instead
        # of silently failing every booking link from now on.
        @connection.update(status: :error)
        Rails.logger.error("[Calendly] token refresh failed for connection #{@connection.id}: #{e.message}")
        raise
      end
  end
end

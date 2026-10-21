module Zoho
  # One connected Zoho mailbox, ready to use.
  #
  # Wraps a ZohoConnection with the two things every message-level Zoho call
  # needs and neither of which is a stored column: a non-expired access token,
  # and the accountId Zoho keys its message endpoints by.
  #
  # Shared by Api::V1::Mail::BaseController and the scan jobs, which need
  # exactly the same preparation from a place that has no controller at all.
  # Two copies of "refresh the token if it is nearly expired" would be two
  # things to get wrong, and the one in a background job is the copy nobody
  # would notice failing.
  class Mailbox
    # Refresh this far ahead of expiry rather than on expiry: a token that
    # dies mid-request is a failed call, and the refresh is cheap.
    REFRESH_MARGIN = 5.minutes
    ACCOUNT_ID_TTL = 1.hour

    attr_reader :connection

    def initialize(connection, client: Client.new)
      @connection = connection
      @client = client
    end

    # A token good for at least REFRESH_MARGIN longer.
    #
    # A failed refresh is logged and the existing token returned rather than
    # raised on: it may still be valid (we refresh early), and if it isn't,
    # the call itself fails with Zoho's own error, which says more than a
    # guess made here would.
    def access_token
      return connection.access_token if connection.refresh_token.blank?
      return connection.access_token if connection.token_expires_at.present? &&
                                        connection.token_expires_at > Time.current + REFRESH_MARGIN

      tokens = @client.refresh_access_token(refresh_token: connection.refresh_token)
      connection.update!(
        access_token: tokens[:access_token],
        token_expires_at: tokens[:expires_in].to_i.seconds.from_now
      )
      connection.access_token
    rescue StandardError => e
      Rails.logger.warn("[zoho] refreshing the access token for connection #{connection.id} failed: #{e.message}")
      connection.access_token
    end

    # Zoho requires an accountId (distinct from our own connection id) on every
    # message-level call — resolved lazily and cached briefly rather than
    # persisted as a new column.
    def account_id
      Rails.cache.fetch("zoho_account_id/#{connection.id}", expires_in: ACCOUNT_ID_TTL) do
        @client.fetch_account_id(access_token: access_token)
      end
    end
  end
end

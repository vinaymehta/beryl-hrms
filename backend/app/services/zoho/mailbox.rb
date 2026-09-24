module Zoho
  # One connected Zoho mailbox, ready to use.
  #
  # Wraps a ZohoConnection with the two things every message-level Zoho call
  # needs and neither of which is a stored column: a non-expired access token,
  # and the accountId Zoho keys its message endpoints by.
  #
  # Extracted from Api::V1::Mail::BaseController because outgoing transactional
  # mail now needs exactly the same preparation from a place that has no
  # controller at all — a Sidekiq job running ActionMailer. Two copies of
  # "refresh the token if it is nearly expired" would be two things to get
  # wrong, and the one in a background job is the copy nobody would notice
  # failing.
  class Mailbox
    class NoConnectionError < StandardError; end

    # Refresh this far ahead of expiry rather than on expiry: a token that
    # dies mid-request is a failed send, and the refresh is cheap.
    REFRESH_MARGIN = 5.minutes
    ACCOUNT_ID_TTL = 1.hour

    attr_reader :connection

    # The mailbox a given company sends from.
    #
    # Prefers a company-managed connection — a shared company mailbox is the
    # right sender for mail the SYSTEM sends, and it survives any one person
    # leaving. Falls back to an individual connection, because a company that
    # has only ever connected one person's mailbox still needs its invitations
    # to go somewhere rather than silently not send.
    def self.for_company(company)
      return nil if company.nil?

      ActsAsTenant.with_tenant(company) do
        scope = ZohoConnection.where(company_id: company.id, status: :active)
        connection = scope.where(connection_type: :company_managed).order(:id).first ||
                     scope.order(:id).first
        connection && new(connection)
      end
    end

    # The mailbox whose address is `address`, whichever company it belongs to.
    #
    # Deliberately crosses tenants, and is only used to honour an explicit
    # MAIL_FROM naming a connected mailbox — an operator-set environment
    # variable, not anything a request can influence.
    def self.for_address(address)
      return nil if address.blank?

      ActsAsTenant.without_tenant do
        connection = ZohoConnection.where(status: :active)
                                   .where("LOWER(email_address) = ?", address.to_s.strip.downcase)
                                   .order(:id).first
        connection && new(connection)
      end
    end

    def initialize(connection, client: Client.new)
      @connection = connection
      @client = client
    end

    def address = connection.email_address

    # A token good for at least REFRESH_MARGIN longer.
    #
    # A failed refresh is logged and the existing token returned rather than
    # raised on: it may still be valid (we refresh early), and if it isn't,
    # the send itself fails with Zoho's own error, which says more than a
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

    def send_mail(to:, subject:, html:, cc: nil, bcc: nil, from: nil)
      @client.send_message(
        access_token: access_token,
        account_id: account_id,
        # Zoho will not send as an address the account doesn't own, so the
        # connected mailbox is the default and any other `from` has to be one
        # of its verified aliases.
        from_address: from.presence || address,
        to_address: to,
        subject: subject,
        content: html,
        cc_address: cc,
        bcc_address: bcc
      )
    end
  end
end

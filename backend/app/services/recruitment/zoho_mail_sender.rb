module Recruitment
  # Sends a recruitment email FROM the company's connected Zoho mailbox rather
  # than through SMTP.
  #
  # Why not ActionMailer's own delivery: mail that reaches candidates has to
  # come from the address the company actually uses. Delivering through SMTP
  # with a generic MAIL_FROM means candidates get mail from an address nobody
  # recognises, replies go nowhere anyone reads, and it is far more likely to
  # be spam-filtered. The connected mailbox is the app's real mail identity —
  # it is already what the Mail compose feature sends through.
  #
  # The ActionMailer classes are still used, purely as the TEMPLATE source: we
  # build the Mail::Message to get the rendered subject, HTML body and any
  # attachments, then hand those to Zoho instead of letting Rails deliver it.
  # That keeps one copy of every template.
  class ZohoMailSender
    Result = Struct.new(:success?, :error, keyword_init: true)

    class NoMailboxError < StandardError; end

    def self.call(...) = new(...).call

    def initialize(mail:, company:, client: ::Zoho::Client.new)
      @mail = mail
      @company = company
      @client = client
    end

    def call
      connection = active_connection
      raise NoMailboxError, "No Zoho mailbox is connected for this company." if connection.nil?

      token = connection.access_token
      account_id = account_id_for(connection, token)
      to = Array(@mail.to).first
      return Result.new(success?: false, error: "No recipient address.") if to.blank?

      @client.send_message(
        access_token: token,
        account_id: account_id,
        from_address: connection.email_address,
        to_address: to,
        subject: @mail.subject,
        content: html_body,
        attachments: upload_attachments(token, account_id)
      )

      Result.new(success?: true, error: nil)
    end

    private

      def active_connection
        ActsAsTenant.with_tenant(@company) do
          @company.zoho_connections.where(status: :active).order(created_at: :asc).first
        end
      end

      # Same cache key the Mail controllers use, so this doesn't re-query an id
      # that's already known.
      def account_id_for(connection, token)
        Rails.cache.fetch("zoho_account_id/#{connection.id}", expires_in: 1.hour) do
          @client.fetch_account_id(access_token: token)
        end
      end

      # Prefer the HTML part; fall back to the text part for a template that
      # only has one. Zoho is told mailFormat: html either way, and plain text
      # renders acceptably as HTML for these short messages.
      def html_body
        (@mail.html_part&.body || @mail.text_part&.body || @mail.body).to_s
      end

      # Each attachment has to be pushed to Zoho first; the descriptors come
      # back and are referenced on send.
      def upload_attachments(token, account_id)
        @mail.attachments.map do |attachment|
          @client.upload_attachment(
            access_token: token,
            account_id: account_id,
            filename: attachment.filename,
            data: attachment.body.decoded,
            content_type: attachment.mime_type
          )
        end
      end
  end
end

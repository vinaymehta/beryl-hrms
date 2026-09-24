module Zoho
  # An ActionMailer delivery method that sends through the Zoho Mail API
  # rather than SMTP.
  #
  # This exists because the product already holds an OAuth connection to the
  # company's Zoho mailbox — the Mail feature reads and sends through it — so
  # asking an operator to separately provision SMTP credentials for the same
  # mailbox is asking them to configure the same thing twice, in a second place
  # that can drift. Outgoing transactional mail now goes out of the same
  # mailbox the rest of the app already uses, authenticated the same way.
  #
  # Registered as `:zoho` in config/initializers/zoho_mail_delivery.rb, so it
  # is selected with `config.action_mailer.delivery_method = :zoho` exactly
  # like `:smtp` or `:letter_opener`.
  #
  # WHICH mailbox sends is resolved per message, in this order:
  #
  #   1. A connected mailbox whose address equals MAIL_FROM. Lets an operator
  #      pin the sender explicitly.
  #   2. The connection belonging to the RECIPIENT's company. This is the
  #      important one: the app is multi-tenant, and an invitation to Acme's
  #      new joiner must leave Acme's mailbox, not whichever company happens
  #      to have connected first.
  #
  # If neither resolves, the send raises. That is deliberate — a delivery
  # method that quietly does nothing is what produced the silent-mail bug this
  # replaces, and in a Sidekiq job a raise is a visible, retrying failure.
  class MailDelivery
    class NoMailboxError < StandardError; end

    attr_reader :settings

    def initialize(settings = {})
      @settings = settings
    end

    def deliver!(message)
      mailbox = resolve_mailbox(message)
      if mailbox.nil?
        raise NoMailboxError,
              "No active Zoho mailbox to send #{message.subject.inspect} from. Connect one under " \
              "Settings → Mail, or set MAIL_TRANSPORT to something other than 'zoho'."
      end

      mailbox.send_mail(
        to: address_list(message.to),
        cc: address_list(message.cc),
        bcc: address_list(message.bcc),
        subject: message.subject,
        html: body_html(message)
      )
    end

    private
      def resolve_mailbox(message)
        Mailbox.for_address(ENV["MAIL_FROM"]) || Mailbox.for_company(recipient_company(message))
      end

      # The company the first recipient belongs to.
      #
      # Crosses tenants by necessity: a mailer job runs with no Current.company
      # (it is the addressee's tenancy that matters, not the sender's, and the
      # job may run long after the request that enqueued it). Reading one
      # user's company_id by their own address is the narrowest lookup that
      # answers the question.
      def recipient_company(message)
        address = Array(message.to).first
        return nil if address.blank?

        ActsAsTenant.without_tenant do
          User.where("LOWER(email_address) = ?", address.to_s.strip.downcase).first&.company
        end
      end

      def address_list(addresses)
        list = Array(addresses).compact_blank
        list.empty? ? nil : list.join(",")
      end

      # Zoho takes one body, and these mails are all multipart. The HTML part
      # is the one written to be read; the text part is the fallback for
      # clients that can't show it, which Zoho isn't.
      def body_html(message)
        part = message.html_part || message.text_part
        body = (part || message).body&.decoded.to_s
        return body if message.html_part

        # A text-only mail still has to arrive as something a mail client will
        # lay out, since the API sends mailFormat: "html" either way.
        "<pre style=\"font-family:inherit;white-space:pre-wrap\">#{ERB::Util.html_escape(body)}</pre>"
      end
  end
end

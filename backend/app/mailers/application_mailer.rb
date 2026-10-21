class ApplicationMailer < ActionMailer::Base
  # Read per-delivery rather than pinned at class-load, so the deployed value
  # applies without depending on when this class happens to be autoloaded.
  # `from@example.com` was Rails' scaffold placeholder — MAIL_FROM has been in
  # .env.example all along but nothing ever consumed it, so every outgoing mail
  # was sent from a non-existent address.
  default from: -> { ENV["MAIL_FROM"].presence || MailBranding::FROM }
  layout "mailer"
  helper MailHelper

  # The header logo rides along inside every message (cid:), so it shows
  # without the mail client fetching anything — and without needing a public
  # URL, which a local or tunnelled deployment doesn't have.
  before_action :attach_brand_logo

  private
    def attach_brand_logo
      attachments.inline[MailBranding::LOGO_FILE] = File.binread(MailBranding.logo_path)
    end

    # True — and logged — when there is nobody to send to. An action that
    # returns without calling `mail` delivers nothing, so this lets a mail with
    # no recipient (an interviewer with no address on file, say) be skipped
    # rather than fail in the job; the log line is what tells that apart from
    # a successful send.
    def missing_recipient?(address, about)
      return false if address.present?

      Rails.logger.error("[#{self.class.name}] #{action_name} not sent for #{about}: no recipient address")
      true
    end

    # Where links in mail templates point. The app's own frontend, never this
    # API host — a recipient clicking through must land on the UI.
    def frontend_base_url
      FrontendOrigins.primary
    end
end

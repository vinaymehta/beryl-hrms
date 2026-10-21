# Everything outgoing mail says about who it is from: the name, the sender
# address, and the logo in the header of every message (layouts/mailer).
module MailBranding
  NAME = "Beryl Systems"
  # Used when MAIL_FROM isn't set. With Resend, berylsystems.com must be a
  # verified domain there or Resend refuses the send.
  FROM = "Beryl Systems HRMS <hrms@berylsystems.com>"
  CONTACT = "hrms@berylsystems.com"
  LOGO_FILE = "beryl-logo.png"

  def self.logo_path = Rails.root.join("app/assets/images", LOGO_FILE)
end

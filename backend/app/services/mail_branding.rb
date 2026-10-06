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

  # The same image, served by the frontend (public/brand/). Only reachable by a
  # mail client when FRONTEND_ORIGINS is a public address.
  def self.logo_url = "#{FrontendOrigins.primary.chomp('/')}/brand/#{LOGO_FILE}"

  # The logo travels INSIDE the message as an inline (cid:) attachment, which
  # works for SMTP/Resend. The Zoho senders post only the HTML to an API, so an
  # inline part never arrives and the image would break — point those at the
  # hosted copy instead.
  def self.with_hosted_images(message, html)
    message.attachments.select(&:inline?).reduce(html.to_s) do |body, part|
      body.gsub("cid:#{part.cid}", logo_url)
    end
  end
end

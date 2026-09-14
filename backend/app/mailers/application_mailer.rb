class ApplicationMailer < ActionMailer::Base
  # Read per-delivery rather than pinned at class-load, so the deployed value
  # applies without depending on when this class happens to be autoloaded.
  # `from@example.com` was Rails' scaffold placeholder — MAIL_FROM has been in
  # .env.example all along but nothing ever consumed it, so every outgoing mail
  # was sent from a non-existent address.
  default from: -> { ENV.fetch("MAIL_FROM", "no-reply@localhost") }
  layout "mailer"
end

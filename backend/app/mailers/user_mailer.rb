class UserMailer < ApplicationMailer
  include ActionView::Helpers::DateHelper

  # Links point at the Next.js frontend's own pages (which read the token
  # from the query string and POST it to the API), not at Rails routes —
  # this is a pure JSON API with no server-rendered pages of its own.
  def password_reset(user)
    @user = user
    @url = "#{frontend_base_url}/reset-password?token=#{user.password_reset_token}"
    mail(to: user.email_address, subject: "Reset your password")
  end

  # The sign-in details an Admin/HR-created employee receives.
  #
  # The password is IN this mail, in plain text, because that is the flow: no
  # link, no setup page, just something to type into the ordinary sign-in
  # form. The password is passed in rather than read off the user, because it
  # cannot be read off the user — only its digest is stored, and this is the
  # single moment at which the plaintext exists to be sent.
  #
  # Nothing about the account is in the subject line, which is the part that
  # shows on a lock screen.
  def credentials(user, password)
    @user = user
    @password = password
    @company_name = user.company&.name
    @must_change = user.must_change_password?
    @sign_in_url = "#{frontend_base_url}/login"
    mail(to: user.email_address, subject: "Your sign-in details for #{@company_name.presence || 'the HR portal'}")
  end

  def email_verification(user)
    @user = user
    @url = "#{frontend_base_url}/verify-email?token=#{user.generate_token_for(:email_verification)}"
    mail(to: user.email_address, subject: "Verify your email address")
  end

  private
    def frontend_base_url
      FrontendOrigins.primary
    end
end

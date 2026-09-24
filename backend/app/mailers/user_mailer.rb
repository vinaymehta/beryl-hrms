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

  # The first-login invitation an Admin/HR-created employee receives.
  #
  # Its own :invitation token rather than the 15-minute password_reset one this
  # used to borrow. The two look alike but are not the same operation: a reset
  # is answered within minutes by someone sitting at the form, an invitation is
  # opened whenever the new joiner next reads their mail. Sharing the short
  # expiry meant most invitations were dead on arrival. See User's
  # :invitation generator for how the link is made single-use.
  def invitation(user)
    @user = user
    @company_name = user.company&.name
    @expires_in = distance_of_time_in_words(User::INVITATION_VALID_FOR)
    @url = "#{frontend_base_url}/accept-invitation?token=#{user.generate_token_for(:invitation)}"
    mail(to: user.email_address, subject: "You've been invited to #{@company_name.presence || 'the HR portal'}")
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

class UserMailer < ApplicationMailer
  # Links point at the Next.js frontend's own pages (which read the token
  # from the query string and POST it to the API), not at Rails routes —
  # this is a pure JSON API with no server-rendered pages of its own.
  def password_reset(user)
    @user = user
    @url = "#{frontend_base_url}/reset-password?token=#{user.password_reset_token}"
    log_link_for_dev("Password reset", @url)
    mail(to: user.email_address, subject: "Reset your password")
  end

  # The invitation an Admin/HR-created employee account receives. Deliberately
  # the SAME password_reset_token primitive (and the same frontend
  # /reset-password page) the forgot-password flow uses rather than a second
  # invitation token of its own — the account is created with no usable
  # password, so "choose your password" and "reset your password" are the same
  # operation with different copy.
  def account_setup(user)
    @user = user
    @company_name = user.company&.name
    @url = "#{frontend_base_url}/reset-password?token=#{user.password_reset_token}"
    log_link_for_dev("Account setup", @url)
    mail(to: user.email_address, subject: "Set up your #{@company_name.presence || 'workspace'} account")
  end

  def email_verification(user)
    @user = user
    @url = "#{frontend_base_url}/verify-email?token=#{user.generate_token_for(:email_verification)}"
    log_link_for_dev("Email verification", @url)
    mail(to: user.email_address, subject: "Verify your email address")
  end

  private
    def frontend_base_url
      FrontendOrigins.primary
    end

    # TEMPORARY dev convenience so links are visible directly on whichever
    # console is running (mail sends via deliver_later, so this prints from
    # the Sidekiq process, not the Rails server one) without needing to open
    # letter_opener — remove once there's a real reason to require it (e.g.
    # this stops being development-only). `puts`, not Rails.logger, so it's
    # guaranteed to hit STDOUT regardless of logger config.
    def log_link_for_dev(label, url)
      return unless Rails.env.development?

      puts "\n\e[35m[#{label} link] #{url}\e[0m\n"
    end
end

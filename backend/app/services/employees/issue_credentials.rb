module Employees
  # Gives an employee a password and emails it to them.
  #
  # This replaces the invitation-link flow outright. There is no token, no
  # setup page and no link to click: the employee receives a password, types
  # it into the ordinary sign-in form, and is in. Both of the old actions —
  # "Invite" for somebody who never had an account, and "Reset password" for
  # somebody who did — are the same operation now, and this is it.
  #
  # Be clear about what that costs, because it is a deliberate trade and not
  # an oversight. A password sent by email is a password that exists in a
  # mailbox, in whatever the mail passed through on the way, and in the
  # administrator's hands if they chose it. The link flow had none of those
  # properties. What is kept instead:
  #
  #   • the password is generated, not chosen, so it is not one the admin
  #     already uses somewhere else;
  #   • issuing a new one invalidates the old one immediately, and signs out
  #     every existing session;
  #   • `force_password_change` makes the emailed password good for exactly
  #     one sign-in, which is the mitigation that actually matters and is why
  #     it defaults to on.
  class IssueCredentials
    class Error < StandardError; end

    Result = Struct.new(:user, :password, :reissued, keyword_init: true)

    def self.call(...) = new(...).call

    # @param password [String, nil] one the administrator supplied. nil means
    #   generate one, which is the normal case.
    # @param force_password_change [Boolean, nil] whether the employee must
    #   replace it at first sign-in. nil leaves whatever the account carries.
    def initialize(employee:, actor: nil, request: nil, password: nil, force_password_change: nil)
      @employee = employee
      @actor = actor
      @request = request
      @password = password.presence
      @force_password_change = force_password_change
    end

    def call
      user = @employee.user
      raise Error, "This employee has no login account yet. Add a work email first." if user.nil?
      raise Error, "This account is disabled. Re-enable it before sending a password." if user.disabled?

      reissued = user.credentials_sent_at.present?
      password = @password || GeneratedPassword.call

      attributes = {
        password: password,
        credentials_sent_at: Time.current,
        status: :active,
        # There is no link to accept any more, so the account is usable the
        # moment it has a password. Stamped so anything still reading this
        # column sees a set-up account rather than one waiting forever.
        invitation_accepted_at: user.invitation_accepted_at || Time.current
      }
      unless @force_password_change.nil?
        attributes[:must_change_password] = ActiveModel::Type::Boolean.new.cast(@force_password_change)
      end

      user.update!(attributes)
      # Anything signed in on the old password goes. Re-issuing is either a
      # new joiner or a suspected problem, and neither is a reason to leave an
      # existing session running.
      user.sessions.destroy_all

      UserMailer.credentials(user, password).deliver_later

      ::Audit::Record.call(
        action: reissued ? "employee.password_reissued" : "employee.credentials_sent",
        actor: @actor, company: @employee.company, auditable: @employee, request: @request
      )

      # The password is returned so the CALLER can show it to the administrator
      # who asked for it, once, on screen. It is never persisted in readable
      # form and never appears in a serializer.
      Result.new(user: user, password: password, reissued: reissued)
    end
  end
end

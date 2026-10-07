module Employees
  # Emails an employee their sign-in details: the password they have NOW.
  #
  # It does not set or change the password — that is the Edit form's job
  # (SetPassword). The flow is: an administrator sets a password in Edit and
  # saves, then presses Send here, choosing whether the employee must replace
  # it at first sign-in. Whatever password the account currently has — the one
  # saved in Edit, or one the employee has since chosen themselves — is what
  # goes out (User#current_password_copy).
  #
  # Be clear about what that costs: a password sent by email exists in a
  # mailbox and in whatever the mail passed through. `force_password_change`
  # is the mitigation — it makes the emailed password good for one sign-in.
  class IssueCredentials
    class Error < StandardError; end

    Result = Struct.new(:user, :password, :reissued, keyword_init: true)

    def self.call(...) = new(...).call

    # @param force_password_change [Boolean, nil] whether the employee must
    #   replace it at first sign-in. nil leaves whatever the account carries.
    def initialize(employee:, actor: nil, request: nil, force_password_change: nil)
      @employee = employee
      @actor = actor
      @request = request
      @force_password_change = force_password_change
    end

    def call
      user = @employee.user
      raise Error, "This employee has no login account yet. Add a work email first." if user.nil?
      raise Error, "This account is disabled. Re-enable it before sending sign-in details." if user.disabled?

      password = user.current_password_copy
      raise Error, "No password is set for this account yet. Set one from Edit and save, then send it." if password.blank?

      reissued = user.credentials_sent_at.present?
      attributes = {
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

      UserMailer.credentials(user, password).deliver_later

      ::Audit::Record.call(
        action: reissued ? "employee.credentials_resent" : "employee.credentials_sent",
        actor: @actor, company: @employee.company, auditable: @employee, request: @request
      )

      Result.new(user: user, password: password, reissued: reissued)
    end
  end
end

module Employees
  # Admin/HR triggering a password reset for an employee who already has an
  # account — the "Set/Reset password" action on the employee record.
  #
  # It sends the employee a link and nothing else. There is no code path here,
  # or anywhere, by which an administrator can read, choose or be shown
  # somebody else's password: the digest is one-way, the reset link goes to the
  # employee's own mailbox, and the response carries only the address it was
  # sent to.
  #
  # For an account that never finished its invitation this defers to Invite
  # instead, so "reset" on a pending employee re-sends the invitation rather
  # than emailing a reset for a password that was never set.
  class PasswordReset
    class Error < StandardError; end

    Result = Struct.new(:user, :sent_to, :kind, keyword_init: true)

    def self.call(...) = new(...).call

    def initialize(employee:, actor: nil, request: nil)
      @employee = employee
      @actor = actor
      @request = request
    end

    def call
      user = @employee.user
      raise Error, "This employee has no login account yet. Add a work email first." if user.nil?

      if user.invitation_accepted_at.nil?
        result = Invite.call(employee: @employee, actor: @actor, request: @request)
        return Result.new(user: result.user, sent_to: result.user.email_address, kind: "invitation")
      end

      UserMailer.password_reset(user).deliver_later

      ::Audit::Record.call(
        action: "employee.password_reset_requested",
        actor: @actor, company: @employee.company, auditable: @employee, request: @request
      )

      Result.new(user: user, sent_to: user.email_address, kind: "password_reset")
    end
  end
end

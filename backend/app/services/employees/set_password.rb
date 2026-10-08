module Employees
  # Sets an employee's password from the Edit form — and only that.
  #
  # Telling them is a separate, deliberate step: the Send button on the
  # employee's page (IssueCredentials), where the administrator also decides
  # whether the employee must change it at first sign-in. Saving the form
  # sends nothing and forces nothing — but the password works from now on:
  # an invited account becomes active, so it can sign in before (or without)
  # the email. A disabled account stays disabled.
  class SetPassword
    def self.call(...) = new(...).call

    def initialize(employee:, password:, actor: nil, request: nil)
      @employee = employee
      @password = password
      @actor = actor
      @request = request
    end

    def call
      user = @employee.user
      raise IssueCredentials::Error, "This employee has no login account yet. Add a work email first." if user.nil?

      attributes = { password: @password }
      if user.invited?
        attributes[:status] = :active
        attributes[:invitation_accepted_at] = user.invitation_accepted_at || Time.current
      end
      user.update!(attributes)
      # The old password stops working now, so nothing signed in on it stays.
      user.sessions.destroy_all

      ::Audit::Record.call(
        action: "employee.password_set",
        actor: @actor, company: @employee.company, auditable: @employee, request: @request
      )
      user
    end
  end
end

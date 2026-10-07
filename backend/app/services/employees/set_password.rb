module Employees
  # Sets an employee's password from the Edit form — and only that.
  #
  # Telling them is a separate, deliberate step: the Send button on the
  # employee's page (IssueCredentials), where the administrator also decides
  # whether the employee must change it at first sign-in. Saving the form
  # sends nothing and forces nothing.
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

      user.update!(password: @password)
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

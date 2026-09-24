module Employees
  # Sends (or re-sends) an employee's first-login invitation.
  #
  # Splitting this out of AccountProvisioner is the point of the feature.
  # Creating the employee and inviting them are now two separate decisions:
  # HR routinely sets a joiner up days before their start date, and the old
  # behaviour — mail goes out the instant the record is saved — meant the
  # link had usually expired by the time it mattered. Admin now presses
  # Invite when the person is actually due to start.
  #
  # What this deliberately does NOT do is set, generate, suggest or return a
  # password. Admin never learns the employee's password because one does not
  # exist until the employee chooses it through the emailed link.
  class Invite
    class Error < StandardError; end

    Result = Struct.new(:user, :invited_at, :resent, keyword_init: true)

    def self.call(...) = new(...).call

    # @param force_password_change [Boolean, nil] when true, the employee is
    #   made to choose a new password before they can use the app. nil leaves
    #   whatever the account already carries alone, so re-sending an
    #   invitation doesn't silently drop the requirement.
    def initialize(employee:, actor: nil, request: nil, force_password_change: nil)
      @employee = employee
      @actor = actor
      @request = request
      @force_password_change = force_password_change
    end

    def call
      user = @employee.user
      raise Error, "This employee has no login account yet. Add a work email first." if user.nil?
      raise Error, "#{user.email_address} has already set up their account." if user.invitation_accepted_at.present?
      raise Error, "This account is disabled. Re-enable it before inviting." if user.disabled?

      resent = user.invited_at.present?

      # Restamping invited_at is what invalidates any previous link: it is part
      # of the token payload, so the older email in the mailbox stops working
      # the moment this one is sent. Two live invitations for one account would
      # be two chances to guess, and a confusing inbox.
      attributes = { invited_at: Time.current, status: :invited }
      attributes[:must_change_password] = ActiveModel::Type::Boolean.new.cast(@force_password_change) unless @force_password_change.nil?
      user.update!(attributes)

      UserMailer.invitation(user).deliver_later

      ::Audit::Record.call(
        action: resent ? "employee.invitation_resent" : "employee.invited",
        actor: @actor, company: @employee.company, auditable: @employee, request: @request
      )

      Result.new(user: user, invited_at: user.invited_at, resent: resent)
    end
  end
end

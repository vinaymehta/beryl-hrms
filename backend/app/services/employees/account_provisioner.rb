module Employees
  # Creates (or links) the User account behind an Employee record and keeps
  # that user's Roles in step with what Admin/HR picked.
  #
  # Three things this deliberately does NOT do:
  #
  #   1. Invent a second role system. Roles are assigned through the existing
  #      User → UserRole → Role tables; Employee carries no role column.
  #   2. Set or return a default password. A new account is created in the
  #      `invited` state with a random secret nobody ever sees, and the person
  #      is emailed one by Employees::IssueCredentials.
  #      An account provisioned with no password is deliberately usable by
  #      nobody: HR often sets a joiner up days before their start date, and a
  #      password mailed at save time has been sitting in an inbox for a week
  #      by the time it is first used. The controller composes the two when the
  #      form carries a password, and leaves the account dormant when it
  #      doesn't.
  #   3. Decide who is allowed to do any of this — that is
  #      EmployeePolicy#manage_roles?, checked by the controller before this
  #      service is reached.
  class AccountProvisioner
    # Every employee account carries this at minimum, on top of whatever else
    # Admin/HR ticked. Looked up by the seeded slug, not hard-coded behaviour:
    # a company that edits the Employee role's permissions from Settings keeps
    # using that same role, with its own definition of what it grants.
    DEFAULT_ROLE_SLUG = "employee".freeze

    Result = Struct.new(:user, :created, keyword_init: true)

    class Error < StandardError; end

    def self.call(...) = new(...).call

    # @param employee [Employee] already persisted
    # @param email [String, nil] work email; required to create a NEW account
    # @param role_ids [Array, nil] nil means "don't touch roles", [] means
    #   "only the default Employee role"
    def initialize(employee:, email: nil, role_ids: nil)
      @employee = employee
      @company = employee.company
      @email = email.to_s.strip.downcase.presence
      @role_ids = role_ids
    end

    def call
      reject_foreign_domain
      user = @employee.user ? rename_existing_account : resolve_user
      return Result.new(user: nil, created: false) if user.nil?

      @employee.update!(user: user) if @employee.user_id != user.id
      sync_roles(user)

      Result.new(user: user, created: @created)
    end

    private
      # Changing the sign-in address of an account that already exists.
      #
      # This used to be refused outright. It is a real identity change — the
      # address IS the login — but refusing it meant a typo in somebody's work
      # email could never be corrected, and people do change name and domain.
      # So it is allowed, and the consequences are handled here rather than
      # left implicit:
      #
      #   • the SAME user row is renamed, so their sessions, roles, appraisals
      #     and history all follow them rather than being orphaned behind a
      #     dead login;
      #   • verification is withdrawn, because nobody has yet proved they can
      #     read the new mailbox;
      #   • the address must not already belong to somebody else in the
      #     company, which User's uniqueness validation enforces — caught here
      #     so it reads as a sentence rather than a 500.
      #
      # Their password is untouched: they keep signing in, at the new address.
      def rename_existing_account
        user = @employee.user
        return user if @email.blank? || @email == user.email_address

        taken = @company.users.where.not(id: user.id).exists?(email_address: @email)
        raise Error, "#{@email} is already in use by another account" if taken

        user.update!(email_address: @email, email_verified_at: nil)
        user
      end

      # The company's work-email domain, when it has set one.
      #
      # Checked here rather than on Employee because this is the only path that
      # turns an address into a login — and it is the login address the rule is
      # about. A company with no domain configured accepts any valid address,
      # which is the only safe default for a tenant whose domain we don't know.
      def reject_foreign_domain
        domain = @company.work_email_domain.to_s.strip.downcase.delete_prefix("@")
        return if domain.blank? || @email.blank?
        return if @email.end_with?("@#{domain}")

        raise Error, "Work email must end with @#{domain}"
      end

      def resolve_user
        if @email.blank?
          # Asking for roles without an account to hang them on is a mistake
          # worth naming, not silently dropping. No email and no roles is
          # perfectly valid though: plenty of employees never get a login.
          raise Error, "A work email is required before this employee can be given roles" if @role_ids.present?

          return nil
        end

        existing = @company.users.find_by(email_address: @email)
        return link(existing) if existing

        create_invited_user
      end

      def link(user)
        other = Employee.where(user_id: user.id).where.not(id: @employee.id).first
        if other
          raise Error, "#{user.email_address} is already linked to employee #{other.employee_code}"
        end

        user
      end

      def create_invited_user
        user = @company.users.create!(
          email_address: @email,
          first_name: @employee.first_name,
          last_name: @employee.last_name,
          # Never shown, never sent, never reused: has_secure_password needs
          # SOME digest to exist, and the account is unusable until the person
          # sets their own through the emailed link.
          password: SecureRandom.base58(48),
          status: :invited
        )
        @created = true
        user
      end

      def sync_roles(user)
        default_role = @company.roles.find_by(slug: DEFAULT_ROLE_SLUG)

        if @role_ids.nil?
          # Not being asked to change the role set — only guarantee the
          # baseline every employee account is supposed to carry.
          return ensure_role(user, default_role)
        end

        desired = @company.roles.where(id: Array(@role_ids).compact_blank).to_a
        desired |= [ default_role ].compact
        desired_ids = desired.map(&:id)
        current_ids = user.user_roles.pluck(:role_id)

        user.user_roles.where(role_id: current_ids - desired_ids).destroy_all
        (desired_ids - current_ids).each { |role_id| user.user_roles.create!(role_id: role_id, company: @company) }

        user.roles.reset
      end

      def ensure_role(user, role)
        return if role.nil? || user.user_roles.exists?(role_id: role.id)

        user.user_roles.create!(role: role, company: @company)
        user.roles.reset
      end
  end
end

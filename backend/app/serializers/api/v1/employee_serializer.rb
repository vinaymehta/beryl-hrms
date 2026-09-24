module Api
  module V1
    class EmployeeSerializer < ApplicationSerializer
      attributes :id, :employee_code, :first_name, :last_name, :status, :date_of_joining,
                 :date_of_birth, :gender, :phone, :personal_email,
                 :address_line1, :address_line2, :city, :state, :postal_code, :country,
                 :emergency_contact_name, :emergency_contact_phone,
                 :user_id, :department_id, :designation_id,
                 # Career level (Intern → Manager). Null for employees whose
                 # level hasn't been recorded; NOT the same thing as the RBAC
                 # roles below — see Employee#current_level.
                 :current_level

      attribute :full_name, &:full_name

      one :department, resource: Api::V1::DepartmentSerializer
      one :designation, resource: Api::V1::DesignationSerializer

      # §4's five relationships. Named slots rather than one list, because the
      # position IS the meaning: a consumer must never have to guess which
      # entry is the final reviewer — and `department_head` is its own slot,
      # never inferred from `final`.
      #
      # `project_managers` is an array; the other four are a single person or
      # null. Everyone who can see the employee can read this, including the
      # employee themselves; changing it needs employees.manage_reporting_managers.
      # Keys camelised by hand: `transform_keys :lower_camel` rewrites the
      # attribute names Alba itself generates, not the keys of a plain Hash
      # handed back from a block. It went unnoticed while every slot was a
      # single word — department_head and project_managers are the first that
      # would have shipped snake_case.
      attribute :manager_hierarchy do |employee|
        employee.manager_hierarchy.to_h do |level, value|
          serialized =
            if value.is_a?(Enumerable)
              Api::V1::EmployeeSummarySerializer.new(value.to_a).as_json
            else
              value && Api::V1::EmployeeSummarySerializer.new(value).as_json
            end

          [ level.camelize(:lower), serialized ]
        end
      end

      # Primary and Final are both required; Secondary is optional. Surfaced so
      # the UI can flag an unfinished hierarchy without re-deriving the rule —
      # see Employee#manager_hierarchy_complete?.
      attribute :manager_hierarchy_complete, &:manager_hierarchy_complete?

      # The linked login account, if there is one: not every employee has a
      # User (see db/seeds.rb). Roles come from the existing
      # User → UserRole → Role chain, never from a column on Employee, and
      # never from a manager assignment.
      attribute :user do |employee|
        next nil if employee.user.nil?

        # Keys written camelCase by hand: `transform_keys :lower_camel`
        # rewrites the attribute names Alba itself generates, not the keys of
        # a plain Hash handed back from a block.
        {
          id: employee.user.id,
          email: employee.user.email_address,
          status: employee.user.status,
          emailVerifiedAt: employee.user.email_verified_at,
          # Null until this account's first login since the field started
          # being recorded — an account that has never been used and one that
          # predates the stamp look the same, which is the honest reading.
          lastLoginAt: employee.user.last_login_at,
          # The invitation state, so the employee list can show "Not invited",
          # "Invitation sent" or "Active" without the client re-deriving the
          # rule from three separate fields. No token is exposed here or
          # anywhere else in the API — the link exists only in the employee's
          # own mailbox.
          invitedAt: employee.user.invited_at,
          invitationAcceptedAt: employee.user.invitation_accepted_at,
          invitationPending: employee.user.invitation_pending?,
          invitationUnsent: employee.user.invitation_unsent?,
          # Admin required a password change; still outstanding.
          mustChangePassword: employee.user.must_change_password?
        }
      end

      attribute :roles do |employee|
        next [] if employee.user.nil?

        Api::V1::RoleSerializer.new(employee.user.roles.to_a).as_json
      end

      # Active Storage's own signed/expiring blob route (not a raw S3/public
      # URL) — a lighter touch than the fully Pundit-gated download flow
      # built for Documents, since a profile photo isn't sensitive the way
      # payslips/contracts are.
      attribute :profile_photo_url do |employee|
        employee.profile_photo.attached? ? Rails.application.routes.url_helpers.rails_blob_path(employee.profile_photo, only_path: true) : nil
      end
    end
  end
end

module Api
  module V1
    class EmployeeSerializer < ApplicationSerializer
      attributes :id, :employee_code, :first_name, :last_name, :status, :date_of_joining,
                 :date_of_birth, :celebration_date, :gender, :personal_email,
                 # Every number they can be reached on, the main one first.
                 :phones,
                 :address_line1, :address_line2, :city, :state, :postal_code, :country,
                 # [{ name, relation, phone }] — single-word keys, so they need
                 # no camelising (see manager_hierarchy below for why that matters).
                 :emergency_contacts, :work_location,
                 :user_id, :department_id, :designation_id, :employment_type_id,
                 # Career level (Intern → Manager). Null for employees whose
                 # level hasn't been recorded; NOT the same thing as the RBAC
                 # roles below — see Employee#current_level.
                 :current_level

      attribute :full_name, &:full_name

      # Bank details and identity numbers — for the employee themselves and
      # Admin/HR only (EmployeePolicy#view_sensitive_details?). For anyone else
      # the keys are absent, not null or masked: what isn't sent can't leak
      # through a devtools panel. Masking for display is the client's job.
      #
      # Left off the directory list too (`params[:list]`): nothing there shows
      # them, and decrypting three columns for every row of every page only
      # widens where they travel.
      attributes :bank_account_number, :bank_account_holder_name, :bank_ifsc_code,
                 :aadhaar_number, :pan_number, :other_identity_numbers,
                 if: proc { |employee| !params[:list] && sensitive_details_visible?(employee) }

      one :department, resource: Api::V1::DepartmentSerializer
      one :designation, resource: Api::V1::DesignationSerializer
      # The name alone: the full EmploymentTypeSerializer counts employees,
      # which would be one extra query per row of the employee list.
      attribute(:employment_type_name) { |employee| employee.employment_type&.name }

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

      # True once a 1st level manager is assigned; every level above that is
      # optional. Surfaced so the UI can flag an unfinished reporting line
      # without re-deriving the rule — see Employee#manager_hierarchy_complete?.
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
          # "Password sent" or "No password yet" without the client
          # re-deriving the rule. The password itself is of course not here:
          # only its digest is stored, and the plaintext existed for exactly
          # as long as it took to put it in an email.
          credentialsSentAt: employee.user.credentials_sent_at,
          credentialsUnsent: employee.user.credentials_unsent?,
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

      private
        # Current.user rather than a param: every caller would otherwise have to
        # remember to pass the viewer, and one that forgot would leak. With no
        # signed-in user (a job, the console) nothing is shown.
        def sensitive_details_visible?(employee)
          EmployeePolicy.new(Current.user, employee).view_sensitive_details?
        end
    end
  end
end

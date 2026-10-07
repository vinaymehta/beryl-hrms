module Api
  module V1
    class EmployeesController < Api::V1::BaseController
      rescue_from ::Employees::AccountProvisioner::Error, with: :render_unprocessable
      rescue_from ::Employees::IssueCredentials::Error, with: :render_unprocessable
      rescue_from ::Employee::ManagerHierarchyError, with: :render_unprocessable

      # §4's five relationships. One request param per slot: absent means
      # "leave this slot alone", an explicit null or "" clears it.
      #
      # The four single-valued slots take an id; `project_manager` takes an
      # ARRAY, which is why it is listed separately — permitting a scalar and an
      # array through one code path would silently drop one of them.
      MANAGER_PARAMS = {
        "primary" => :primary_manager_id,
        "secondary" => :secondary_manager_id,
        "final" => :final_manager_id,
        "department_head" => :department_head_id
      }.freeze

      # `additional_manager_ids` is ORDERED — position in the array is the
      # reporting tier (4th level, 5th level, …), so it is never sorted or
      # deduplicated on the way through.
      # Ten rows a page unless asked otherwise, and never more than a hundred:
      # `?perPage=` is user input that sizes a query, so it is clamped rather
      # than trusted.
      DEFAULT_PER_PAGE = 10
      MAX_PER_PAGE = 100

      MULTI_MANAGER_PARAMS = {
        "project_manager" => :project_manager_ids,
        "additional" => :additional_manager_ids
      }.freeze

      # What an employee may change about themselves (#update_personal) — a
      # subset of employee_params, and the whole of what that path permits.
      PERSONAL_PARAMS = %i[
        date_of_birth gender phone personal_email
        address_line1 address_line2 city state postal_code country
        emergency_contact_name emergency_contact_phone
      ].freeze

      def index
        authorize Employee
        scope = policy_scope(Employee).includes(
          :department, :designation, :employment_type,
          { profile_photo_attachment: :blob },
          { manager_assignments: { manager: [ :department, :designation, { profile_photo_attachment: :blob } ] } },
          { user: :roles }
        )
        scope = scope.where(department_id: params[:departmentId]) if params[:departmentId].present?
        scope = scope.where(designation_id: params[:designationId]) if params[:designationId].present?
        scope = scope.where(status: params[:status]) if params[:status].present?
        scope = scope.where(current_level: params[:currentLevel]) if params[:currentLevel].present?
        if params[:q].present?
          q = "%#{params[:q]}%"
          scope = scope.where("first_name ILIKE :q OR last_name ILIKE :q OR employee_code ILIKE :q", q: q)
        end
        scope = sorted(scope)

        # Hand-rolled offset pagination, not Pagy: the installed Pagy
        # version (43.6.2) turned out to be a ground-up API rewrite with no
        # Backend module and no reliably-known replacement API under this
        # pass's time budget — plain limit/offset is simple and correct, and
        # not worth guessing at an unfamiliar gem surface for. Revisit if a
        # real reason to depend on Pagy specifically comes up later.
        page = [ params[:page].to_i, 1 ].max
        per_page = (params[:perPage].presence || DEFAULT_PER_PAGE).to_i.clamp(1, MAX_PER_PAGE)
        total_count = scope.count
        records = scope.limit(per_page).offset((page - 1) * per_page)

        render json: {
          data: Api::V1::EmployeeSerializer.new(records).as_json,
          meta: { page: page, perPage: per_page, totalPages: (total_count / per_page.to_f).ceil, totalCount: total_count }
        }
      end

      # GET /api/v1/employees/code_available?code=ACM-007&excludeId=12
      #
      # The same two rules the model applies on save — unique within the
      # company, and not below the Initial ID — so the form can show the
      # problem under the field as it is typed. `excludeId` is the employee
      # being edited, whose own current code is of course not "taken".
      def code_available
        authorize Employee, :code_available?
        code = params[:code].to_s.strip
        taken = code.present? &&
                current_company.employees.where(employee_code: code).where.not(id: params[:excludeId].presence).exists?
        floor = Employee.employee_code_floor_error(current_company, code)
        message =
          if taken then "This employee ID is already in use"
          elsif floor then "Employee ID #{floor}"
          end
        render_data({ available: message.nil?, message: message })
      end

      # GET /api/v1/employees/next_code
      def next_code
        authorize Employee, :create?
        render_data({ employeeCode: ::Employees::NextCode.call(company: current_company) })
      end

      def show
        employee = policy_scope(Employee).find(params[:id])
        authorize employee
        render_data(Api::V1::EmployeeSerializer.new(employee).as_json)
      end

      # One transaction for the whole thing: the employee row, the manager
      # hierarchy, the User account and its roles either all land or none do —
      # a half-created employee with an orphan invited login would be worse
      # than a failed request.
      def create
        authorize Employee
        employee = nil

        ActiveRecord::Base.transaction do
          employee = current_company.employees.new(employee_params)
          employee.save!
          apply_manager_hierarchy(employee)
          apply_account_and_roles(employee)
          ::Audit::Record.call(action: "employee.created", auditable: employee, request: request)
        end

        render_data(Api::V1::EmployeeSerializer.new(employee.reload).as_json, status: :created)
      end

      def update
        employee = policy_scope(Employee).find(params[:id])
        authorize employee
        before = employee.attributes.slice(*employee_params.keys.map(&:to_s))

        ActiveRecord::Base.transaction do
          employee.update!(employee_params)
          apply_manager_hierarchy(employee)
          apply_account_and_roles(employee)
          ::Audit::Record.call(
            action: "employee.updated", auditable: employee, request: request,
            before_changes: before, after_changes: employee.attributes.slice(*employee_params.keys.map(&:to_s))
          )
        end

        render_data(Api::V1::EmployeeSerializer.new(employee.reload).as_json)
      end

      # PATCH /api/v1/employees/:id/personal — an employee correcting their own
      # personal details from Profile. Saved straight away, no approval: these
      # are facts about the person that they know better than HR does.
      #
      # Only PERSONAL_PARAMS are read, so anything else in the body (a
      # department, a name, roles) is dropped rather than applied — and no
      # manager / account block runs on this path at all. The same model
      # validations as HR's edit apply.
      def update_personal
        employee = policy_scope(Employee).find(params[:id])
        authorize employee, :update_personal?
        attributes = params.permit(*PERSONAL_PARAMS)
        before = employee.attributes.slice(*attributes.keys)

        ActiveRecord::Base.transaction do
          employee.update!(attributes)
          ::Audit::Record.call(
            action: "employee.personal_updated", auditable: employee, request: request,
            before_changes: before, after_changes: employee.attributes.slice(*attributes.keys)
          )
        end

        render_data(Api::V1::EmployeeSerializer.new(employee.reload).as_json)
      end

      # PATCH /api/v1/employees/:id/deactivate — the "delete" action, per the
      # spec's "prefer deactivation over destroying historical records."
      # Also doubles as the reactivate action (status: "active") — same
      # permission gate and audit trail apply either direction.
      def deactivate
        employee = policy_scope(Employee).find(params[:id])
        authorize employee, :deactivate?
        new_status = params[:status].presence || :inactive
        employee.update!(status: new_status)
        ::Audit::Record.call(
          action: new_status.to_s == "active" ? "employee.reactivated" : "employee.deactivated",
          auditable: employee, request: request
        )
        render_data(Api::V1::EmployeeSerializer.new(employee).as_json)
      end

      # POST /api/v1/employees/:id/invite — email this employee a password.
      #
      # Kept at the same route as the old "invite" action, because it occupies
      # the same place in the workflow: HR sets a joiner up in advance and
      # presses this on the day they actually start. What it sends is no longer
      # a link but the password itself.
      def invite
        issue_credentials(resend: false)
      end

      # POST /api/v1/employees/:id/reset_password — email their sign-in
      # details again. The same operation as #invite: both send the CURRENT
      # password (set from Edit) and change nothing about it; they differ only
      # in what the response says.
      def reset_password
        issue_credentials(resend: true)
      end

      # GET /api/v1/employees/:id/current_password — the password this
      # employee signs in with now, for an administrator to read. Same gate as
      # sending one. nil when none has been recorded (set before this existed).
      def current_password
        employee = policy_scope(Employee).find(params[:id])
        authorize employee, :manage_account_access?
        render_data({ password: employee.user&.current_password_copy })
      end

      private
        # Which columns may be sorted on, and how each is expressed in SQL.
        #
        # An allowlist rather than interpolating whatever arrives: `?sortBy=` is
        # user input going into an ORDER BY, and the list is also the honest
        # answer to "what can this be sorted by" — a column that isn't here
        # simply isn't offered.
        SORTABLE = {
          "name" => "employees.first_name, employees.last_name",
          "employeeCode" => "employees.employee_code",
          "status" => "employees.status",
          "dateOfJoining" => "employees.date_of_joining",
          "currentLevel" => "employees.current_level",
          "department" => "departments.name",
          "designation" => "designations.title"
        }.freeze

        def sorted(scope)
          column = SORTABLE[params[:sortBy].to_s]
          # Newest first when no column is chosen — the most recently added
          # people are the ones most likely to be looked for. `id` breaks ties
          # between rows created in the same instant (seeds, imports).
          return scope.order(created_at: :desc, id: :desc) if column.nil?

          direction = params[:sortDir].to_s.casecmp("desc").zero? ? "DESC" : "ASC"
          # LEFT JOIN so somebody with no department still appears when sorting
          # by one, rather than vanishing from the list.
          scope = scope.left_joins(:department) if column.start_with?("departments.")
          scope = scope.left_joins(:designation) if column.start_with?("designations.")

          # NULLS LAST in both directions: a blank is an absence, and an absence
          # is never the most interesting row.
          scope.order(Arel.sql(column.split(", ").map { |c| "#{c} #{direction} NULLS LAST" }.join(", ")))
        end

        def issue_credentials(resend:)
          employee = policy_scope(Employee).find(params[:id])
          authorize employee, :manage_account_access?

          # Sends the password the account has NOW (set from Edit, or chosen by
          # the employee since) — never a new one. See IssueCredentials.
          result = ::Employees::IssueCredentials.call(
            employee: employee, actor: Current.user, request: request,
            force_password_change: params.key?(:force_password_change) ? params[:force_password_change] : nil
          )

          render_data({
            message: credentials_message(result, resend: resend),
            # Shown to the administrator on screen, so they can read it out to
            # somebody whose mail has not arrived. Also kept as the user's
            # current_password_copy (see User#password=), never in the employee
            # payload below.
            password: result.password,
            employee: Api::V1::EmployeeSerializer.new(employee.reload).as_json
          })
        end

        def credentials_message(result, resend:)
          lead =
            if resend
              "Sign-in details have been emailed again to #{result.user.email_address}."
            else
              "Sign-in details have been emailed to #{result.user.email_address}."
            end
          return "#{lead} They'll be asked to choose their own the first time they sign in." if result.user.must_change_password?

          lead
        end

        def employee_params
          params.permit(
            :employee_code, :first_name, :last_name, :department_id, :designation_id,
            :date_of_joining, :status, :current_level, :employment_type_id, :work_location,
            :date_of_birth, :gender, :phone, :personal_email,
            :address_line1, :address_line2, :city, :state, :postal_code, :country,
            :emergency_contact_name, :emergency_contact_phone, :profile_photo
          )
        end

        # Both blocks below are applied only when their keys are actually
        # present in the request. That distinction matters: an edit that never
        # mentions roles must leave the person's roles alone rather than
        # reading "absent" as "remove everything", and a request that doesn't
        # touch the manager hierarchy must not need the permission to change it.
        def apply_manager_hierarchy(employee)
          submitted = MANAGER_PARAMS.select { |_level, key| params.key?(key) }
                                    .transform_values { |key| params[key] }
          MULTI_MANAGER_PARAMS.each do |level, key|
            next unless params.key?(key)

            submitted[level] = Array(params.permit(key => [])[key])
          end
          return if submitted.empty?

          authorize employee, :manage_reporting_managers?
          employee.assign_managers!(submitted)
          ::Audit::Record.call(action: "employee.managers_assigned", auditable: employee, request: request)
        end

        def apply_account_and_roles(employee)
          return unless params.key?(:work_email) || params.key?(:role_ids) || params[:password].present?

          authorize employee, :manage_roles?
          ::Employees::AccountProvisioner.call(
            employee: employee,
            email: params[:work_email],
            role_ids: params.key?(:role_ids) ? Array(params.permit(role_ids: [])[:role_ids]) : nil
          )

          # A password on the form is SET here and nothing more — no email, no
          # forced change. Sending it is the separate Send button on the
          # employee's page (IssueCredentials), where the administrator also
          # chooses whether it must be changed at first sign-in.
          return if params[:password].blank?
          return if employee.reload.user.nil?

          ::Employees::SetPassword.call(
            employee: employee, password: params[:password], actor: Current.user, request: request
          )
        end
    end
  end
end

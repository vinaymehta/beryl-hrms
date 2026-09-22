module Api
  module V1
    class EmployeesController < Api::V1::BaseController
      rescue_from ::Employees::AccountProvisioner::Error, with: :render_unprocessable
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

      MULTI_MANAGER_PARAMS = { "project_manager" => :project_manager_ids }.freeze

      def index
        authorize Employee
        scope = policy_scope(Employee).includes(
          :department, :designation,
          { manager_assignments: { manager: %i[department designation] } },
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
        scope = scope.order(:last_name)

        # Hand-rolled offset pagination, not Pagy: the installed Pagy
        # version (43.6.2) turned out to be a ground-up API rewrite with no
        # Backend module and no reliably-known replacement API under this
        # pass's time budget — plain limit/offset is simple and correct, and
        # not worth guessing at an unfamiliar gem surface for. Revisit if a
        # real reason to depend on Pagy specifically comes up later.
        page = [ params[:page].to_i, 1 ].max
        per_page = (params[:perPage].presence || 25).to_i.clamp(1, 100)
        total_count = scope.count
        records = scope.limit(per_page).offset((page - 1) * per_page)

        render json: {
          data: Api::V1::EmployeeSerializer.new(records).as_json,
          meta: { page: page, perPage: per_page, totalPages: (total_count / per_page.to_f).ceil, totalCount: total_count }
        }
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

      private
        def employee_params
          params.permit(
            :employee_code, :first_name, :last_name, :department_id, :designation_id,
            :date_of_joining, :status, :current_level, :employment_type, :work_location,
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
          return unless params.key?(:work_email) || params.key?(:role_ids)

          authorize employee, :manage_roles?
          ::Employees::AccountProvisioner.call(
            employee: employee,
            email: params[:work_email],
            role_ids: params.key?(:role_ids) ? Array(params.permit(role_ids: [])[:role_ids]) : nil
          )
        end
    end
  end
end

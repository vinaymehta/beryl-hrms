module Api
  module V1
    class EmployeesController < Api::V1::BaseController
      def index
        authorize Employee
        scope = policy_scope(Employee).includes(:department, :designation)
        scope = scope.where(department_id: params[:departmentId]) if params[:departmentId].present?
        scope = scope.where(designation_id: params[:designationId]) if params[:designationId].present?
        scope = scope.where(status: params[:status]) if params[:status].present?
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

      def create
        authorize Employee
        employee = current_company.employees.new(employee_params)
        employee.save!
        ::Audit::Record.call(action: "employee.created", auditable: employee, request: request)
        render_data(Api::V1::EmployeeSerializer.new(employee).as_json, status: :created)
      end

      def update
        employee = policy_scope(Employee).find(params[:id])
        authorize employee
        before = employee.attributes.slice(*employee_params.keys.map(&:to_s))
        employee.update!(employee_params)
        ::Audit::Record.call(
          action: "employee.updated", auditable: employee, request: request,
          before_changes: before, after_changes: employee.attributes.slice(*employee_params.keys.map(&:to_s))
        )
        render_data(Api::V1::EmployeeSerializer.new(employee).as_json)
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
            :date_of_joining, :status, :date_of_birth, :gender, :phone, :personal_email,
            :address_line1, :address_line2, :city, :state, :postal_code, :country,
            :emergency_contact_name, :emergency_contact_phone, :profile_photo
          )
        end
    end
  end
end

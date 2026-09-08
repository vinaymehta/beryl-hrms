module Api
  module V1
    class LeavesController < Api::V1::BaseController
      def index
        authorize LeaveRequest
        scope = policy_scope(LeaveRequest).includes(:employee)
        # ?mine=true scopes to the current user's own employee record —
        # used by the frontend's "My requests" list.
        if ActiveModel::Type::Boolean.new.cast(params[:mine])
          employee = current_company.employees.find_by(user_id: Current.user.id)
          scope = scope.where(employee_id: employee&.id)
        end
        scope = scope.where(status: params[:status]) if params[:status].present?
        scope = scope.where(employee_id: params[:employeeId]) if params[:employeeId].present?
        render_data(Api::V1::LeaveRequestSerializer.new(scope.order(created_at: :desc)).as_json)
      end

      def create
        authorize LeaveRequest
        employee = current_company.employees.find_by(user_id: Current.user.id) || current_company.employees.find(params[:employee_id])
        leave = current_company.leave_requests.new(leave_params.merge(employee: employee))
        leave.save!
        ::Audit::Record.call(action: "leave.requested", auditable: leave, request: request)
        render_data(Api::V1::LeaveRequestSerializer.new(leave).as_json, status: :created)
      end

      # PATCH /api/v1/leaves/:id — body: { status: "approved" | "rejected" }
      def update
        leave = policy_scope(LeaveRequest).find(params[:id])
        authorize leave

        new_status = params[:status]
        unless %w[approved rejected].include?(new_status)
          return render json: { errors: [ { code: "invalid_status", message: "status must be approved or rejected" } ] },
                         status: :unprocessable_content
        end

        leave.update!(status: new_status, approved_by: Current.user, approved_at: Time.current)
        ::Audit::Record.call(action: "leave.#{new_status}", auditable: leave, request: request)
        render_data(Api::V1::LeaveRequestSerializer.new(leave).as_json)
      end

      private
        def leave_params
          params.permit(:leave_type, :start_date, :end_date, :reason)
        end
    end
  end
end

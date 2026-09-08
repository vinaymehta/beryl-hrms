module Api
  module V1
    class AttendanceController < Api::V1::BaseController
      def index
        authorize AttendanceRecord
        scope = policy_scope(AttendanceRecord).includes(:employee)
        scope = scope.where(employee_id: params[:employeeId]) if params[:employeeId].present?
        scope = scope.where(date: params[:from]..params[:to]) if params[:from].present? && params[:to].present?
        render_data(Api::V1::AttendanceRecordSerializer.new(scope.order(date: :desc)).as_json)
      end

      def today
        authorize AttendanceRecord, :index?
        employee = resolve_employee
        record = current_company.attendance_records.find_by(employee: employee, date: Date.current)
        if record
          render_data(Api::V1::AttendanceRecordSerializer.new(record).as_json)
        else
          render_data({ checkInAt: nil, checkOutAt: nil })
        end
      end

      def check_in
        authorize AttendanceRecord, :check_in?
        employee = resolve_employee
        record = current_company.attendance_records.find_or_initialize_by(employee: employee, date: Date.current)
        record.check_in_at = Time.current
        record.status = :present
        record.save!
        ::Audit::Record.call(action: "attendance.checked_in", auditable: record, request: request)
        render_data(Api::V1::AttendanceRecordSerializer.new(record).as_json)
      end

      def check_out
        authorize AttendanceRecord, :check_out?
        employee = resolve_employee
        record = current_company.attendance_records.find_by!(employee: employee, date: Date.current)
        record.update!(check_out_at: Time.current)
        ::Audit::Record.call(action: "attendance.checked_out", auditable: record, request: request)
        render_data(Api::V1::AttendanceRecordSerializer.new(record).as_json)
      end

      private

        # Falls back to the current user's employee record when no explicit
        # employee_id is provided — matches the leave controller's pattern.
        def resolve_employee
          if params[:employee_id].present?
            current_company.employees.find(params[:employee_id])
          else
            current_company.employees.find_by!(user_id: Current.user.id)
          end
        end
    end
  end
end

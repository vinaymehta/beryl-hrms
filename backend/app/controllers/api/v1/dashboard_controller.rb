module Api
  module V1
    class DashboardController < Api::V1::BaseController
      def summary
        start_of_week = Date.current.beginning_of_week
        weekly_attendance = (0..4).map do |i|
          day_date = start_of_week + i.days
          {
            day: day_date.strftime("%a"),
            date: day_date.to_s,
            present: current_company.attendance_records.where(date: day_date, status: :present).count
          }
        end

        render_data({
          employeeCount: current_company.employees.active.count,
          departmentCount: current_company.departments.active.count,
          onLeaveToday: current_company.leave_requests.where(status: :approved)
                          .where("start_date <= ? AND end_date >= ?", Date.current, Date.current).count,
          pendingApprovals: current_company.leave_requests.where(status: :pending).count,
          weeklyAttendance: weekly_attendance
        })
      end
    end
  end
end

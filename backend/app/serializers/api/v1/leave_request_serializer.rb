module Api
  module V1
    class LeaveRequestSerializer < ApplicationSerializer
      attributes :id, :employee_id, :leave_type, :start_date, :end_date, :reason,
                 :status, :approved_by_id, :approved_at, :created_at

      attribute :employee_name do |leave_request|
        leave_request.employee&.full_name
      end
    end
  end
end

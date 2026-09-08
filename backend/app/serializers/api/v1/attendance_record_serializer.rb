module Api
  module V1
    class AttendanceRecordSerializer < ApplicationSerializer
      attributes :id, :employee_id, :date, :check_in_at, :check_out_at, :status, :notes

      attribute :employee_name do |record|
        record.employee&.full_name
      end
    end
  end
end

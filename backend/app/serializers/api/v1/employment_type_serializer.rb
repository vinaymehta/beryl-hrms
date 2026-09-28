module Api
  module V1
    class EmploymentTypeSerializer < ApplicationSerializer
      attributes :id, :name, :description, :status

      # What deleting this would affect, as on DepartmentSerializer.
      attribute :employee_count do |employment_type|
        employment_type.employees.size
      end
    end
  end
end

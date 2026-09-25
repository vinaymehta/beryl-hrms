module Api
  module V1
    class DepartmentSerializer < ApplicationSerializer
      attributes :id, :name, :description, :status

      # What deleting this would affect. Employees keep pointing at an
      # archived department (archiving is an update, not a destroy, so
      # `dependent: :nullify` never fires) — but the person about to press
      # Delete should still be told how many people are in it rather than
      # discovering the number afterwards.
      attribute :employee_count do |department|
        department.employees.size
      end

      attribute :designation_count do |department|
        department.designations.size
      end
    end
  end
end

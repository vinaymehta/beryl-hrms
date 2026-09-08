module Api
  module V1
    class DepartmentSerializer < ApplicationSerializer
      attributes :id, :name, :description, :status
    end
  end
end

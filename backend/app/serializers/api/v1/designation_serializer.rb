module Api
  module V1
    class DesignationSerializer < ApplicationSerializer
      attributes :id, :title, :level, :status, :department_id
    end
  end
end

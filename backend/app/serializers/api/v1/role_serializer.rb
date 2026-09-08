module Api
  module V1
    class RoleSerializer < ApplicationSerializer
      attributes :id, :name, :slug
    end
  end
end

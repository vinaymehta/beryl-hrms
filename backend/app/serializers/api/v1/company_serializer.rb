module Api
  module V1
    class CompanySerializer < ApplicationSerializer
      attributes :id, :name, :slug
    end
  end
end

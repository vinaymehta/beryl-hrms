module Api
  module V1
    class RoleSerializer < ApplicationSerializer
      # description/system_default are additive — every existing consumer
      # (Auth::MePresenter and the frontend's Role type) reads id/name/slug and
      # ignores the rest; the roles picker uses the description as helper text
      # and system_default to mark the four seeded roles.
      attributes :id, :name, :slug, :description, :system_default
    end
  end
end

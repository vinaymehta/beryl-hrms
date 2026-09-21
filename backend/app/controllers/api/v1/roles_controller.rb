module Api
  module V1
    # The company's own roles, for pickers that assign them (today: the
    # Employee create/edit form). Deliberately read-only — nothing here
    # creates, edits or deletes a role; that is Settings' job.
    class RolesController < Api::V1::BaseController
      def index
        authorize Role
        roles = policy_scope(Role).order(:name)
        render_data(Api::V1::RoleSerializer.new(roles).as_json)
      end
    end
  end
end

module Api
  module V1
    # Mirrors DepartmentsController: delete archives, and the list leaves
    # archived rows out so a deleted type is never offered on the employee form.
    class EmploymentTypesController < Api::V1::BaseController
      def index
        authorize EmploymentType
        scope = policy_scope(EmploymentType).active.includes(:employees).order(created_at: :desc, id: :desc)
        render_data(Api::V1::EmploymentTypeSerializer.new(scope).as_json)
      end

      def show
        employment_type = policy_scope(EmploymentType).find(params[:id])
        authorize employment_type
        render_data(Api::V1::EmploymentTypeSerializer.new(employment_type).as_json)
      end

      def create
        authorize EmploymentType
        # Re-adding a name that was deleted brings that row back rather than
        # failing the uniqueness check on a type nobody can see any more.
        archived = current_company.employment_types.archived.find_by(name: employment_type_params[:name])
        employment_type =
          if archived
            archived.update!(employment_type_params.merge(status: :active))
            archived
          else
            current_company.employment_types.create!(employment_type_params)
          end
        ::Audit::Record.call(action: "employment_type.created", auditable: employment_type, request: request)
        render_data(Api::V1::EmploymentTypeSerializer.new(employment_type).as_json, status: :created)
      end

      def update
        employment_type = policy_scope(EmploymentType).find(params[:id])
        authorize employment_type
        employment_type.update!(employment_type_params)
        ::Audit::Record.call(action: "employment_type.updated", auditable: employment_type, request: request)
        render_data(Api::V1::EmploymentTypeSerializer.new(employment_type).as_json)
      end

      def destroy
        employment_type = policy_scope(EmploymentType).find(params[:id])
        authorize employment_type
        employment_type.update!(status: :archived)
        ::Audit::Record.call(action: "employment_type.archived", auditable: employment_type, request: request)
        head :no_content
      end

      private
        def employment_type_params
          params.permit(:name, :description, :status)
        end
    end
  end
end

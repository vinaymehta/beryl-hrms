module Api
  module V1
    class DepartmentsController < Api::V1::BaseController
      # Archived departments are excluded.
      #
      # #destroy archives rather than deletes, to keep the historical record
      # for employees who were once in the department — but from every caller's
      # point of view a deleted department is gone, and this list feeds the
      # employee form's department picker as well as the settings screen.
      # Leaving archived rows in it would offer people a department that has
      # been deleted.
      def index
        authorize Department
        scope = policy_scope(Department).active.order(:name)
        render_data(Api::V1::DepartmentSerializer.new(scope).as_json)
      end

      def show
        department = policy_scope(Department).find(params[:id])
        authorize department
        render_data(Api::V1::DepartmentSerializer.new(department).as_json)
      end

      def create
        authorize Department
        department = current_company.departments.create!(department_params)
        ::Audit::Record.call(action: "department.created", auditable: department, request: request)
        render_data(Api::V1::DepartmentSerializer.new(department).as_json, status: :created)
      end

      def update
        department = policy_scope(Department).find(params[:id])
        authorize department
        department.update!(department_params)
        ::Audit::Record.call(action: "department.updated", auditable: department, request: request)
        render_data(Api::V1::DepartmentSerializer.new(department).as_json)
      end

      def destroy
        department = policy_scope(Department).find(params[:id])
        authorize department
        department.update!(status: :archived)
        ::Audit::Record.call(action: "department.archived", auditable: department, request: request)
        head :no_content
      end

      private
        def department_params
          params.permit(:name, :description, :status)
        end
    end
  end
end

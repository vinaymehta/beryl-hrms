module Api
  module V1
    class DepartmentsController < Api::V1::BaseController
      def index
        authorize Department
        render_data(Api::V1::DepartmentSerializer.new(policy_scope(Department).order(:name)).as_json)
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

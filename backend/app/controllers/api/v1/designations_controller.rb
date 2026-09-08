module Api
  module V1
    class DesignationsController < Api::V1::BaseController
      def index
        authorize Designation
        scope = policy_scope(Designation)
        scope = scope.where(department_id: params[:departmentId]) if params[:departmentId].present?
        render_data(Api::V1::DesignationSerializer.new(scope.order(:title)).as_json)
      end

      def show
        designation = policy_scope(Designation).find(params[:id])
        authorize designation
        render_data(Api::V1::DesignationSerializer.new(designation).as_json)
      end

      def create
        authorize Designation
        designation = current_company.designations.create!(designation_params)
        ::Audit::Record.call(action: "designation.created", auditable: designation, request: request)
        render_data(Api::V1::DesignationSerializer.new(designation).as_json, status: :created)
      end

      def update
        designation = policy_scope(Designation).find(params[:id])
        authorize designation
        designation.update!(designation_params)
        ::Audit::Record.call(action: "designation.updated", auditable: designation, request: request)
        render_data(Api::V1::DesignationSerializer.new(designation).as_json)
      end

      def destroy
        designation = policy_scope(Designation).find(params[:id])
        authorize designation
        designation.update!(status: :archived)
        ::Audit::Record.call(action: "designation.archived", auditable: designation, request: request)
        head :no_content
      end

      private
        def designation_params
          params.permit(:title, :level, :status, :department_id)
        end
    end
  end
end

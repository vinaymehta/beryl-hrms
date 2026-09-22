module Api
  module V1
    class AppraisalTemplatesController < Api::V1::BaseController
      def index
        authorize AppraisalTemplate
        templates = policy_scope(AppraisalTemplate)
                      .includes(categories: :questions)
                      .order(:name, :version)
        templates = templates.where(status: params[:status]) if params[:status].present?
        render_data(Api::V1::AppraisalTemplateSerializer.new(templates).as_json)
      end

      def show
        template = find_template
        authorize template
        render_data(Api::V1::AppraisalTemplateSerializer.new(template).as_json)
      end

      def create
        authorize AppraisalTemplate
        template = current_company.appraisal_templates.new(template_params.merge(created_by: Current.user))
        template.save!
        ::Audit::Record.call(action: "appraisal_template.created", auditable: template, request: request)
        render_data(Api::V1::AppraisalTemplateSerializer.new(template.reload).as_json, status: :created)
      end

      # Refused by the model once a cycle has started against this template —
      # see AppraisalTemplate#refuse_edit_once_in_use. Callers get a 422 and are
      # pointed at #new_version instead.
      def update
        template = find_template
        authorize template
        template.update!(template_params)
        ::Audit::Record.call(action: "appraisal_template.updated", auditable: template, request: request)
        render_data(Api::V1::AppraisalTemplateSerializer.new(template.reload).as_json)
      end

      # The supported way to change a template that history depends on: copy it
      # forward as a new draft version, leaving every past appraisal untouched.
      def new_version
        source = find_template
        authorize source, :new_version?
        copy = source.build_next_version(name: params[:name].presence || source.name)
        copy.save!
        ::Audit::Record.call(action: "appraisal_template.versioned", auditable: copy, request: request)
        render_data(Api::V1::AppraisalTemplateSerializer.new(copy.reload).as_json, status: :created)
      end

      def activate
        template = find_template
        authorize template, :activate?
        template.update!(status: :active)
        ::Audit::Record.call(action: "appraisal_template.activated", auditable: template, request: request)
        render_data(Api::V1::AppraisalTemplateSerializer.new(template.reload).as_json)
      end

      def destroy
        template = find_template
        authorize template
        template.update!(status: :archived)
        ::Audit::Record.call(action: "appraisal_template.archived", auditable: template, request: request)
        head :no_content
      end

      private
        def find_template
          policy_scope(AppraisalTemplate).includes(categories: :questions).find(params[:id])
        end

        def template_params
          params.permit(
            :name, :description, :status,
            categories_attributes: [
              :id, :name, :description, :lens, :weight, :position, :_destroy,
              { questions_attributes: %i[id prompt description position self_rating manager_rating requires_comment required _destroy] }
            ]
          )
        end
    end
  end
end

module Api
  module V1
    class AppraisalTemplatesController < Api::V1::BaseController
      rescue_from ::Appraisals::TemplateImport::Error, with: :render_unprocessable
      # Archived templates are hidden unless asked for by name.
      #
      # #destroy archives rather than deletes, because a cycle that ran against
      # a template must keep resolving to it — but from the builder's point of
      # view a deleted template is gone, and leaving it in the list means
      # offering a template nobody may use. `?status=archived` still reaches
      # them, so nothing is unreachable.
      def index
        authorize AppraisalTemplate
        templates = policy_scope(AppraisalTemplate)
                      .includes(categories: :questions)
                      .order(:name, :version)
        templates = if params[:status].present?
          templates.where(status: params[:status])
        else
          templates.where.not(status: :archived)
        end
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

      # Upload → Validate → Parse → PREVIEW. Persists nothing: the parsed
      # categories go back to the builder for the admin to review and confirm,
      # and #create writes them — so every template rule applies unchanged.
      def import_preview
        authorize AppraisalTemplate, :create?
        preview = ::Appraisals::TemplateImport.call(file: params[:file])
        # Plain Hash from a service, so it never passes through Alba's key
        # transform — camelised here instead.
        render_data(preview.deep_transform_keys { |key| key.to_s.camelize(:lower) })
      end

      # A blank workbook carrying the exact headers the importer reads, so an
      # admin doesn't have to guess the format from documentation.
      def import_format
        authorize AppraisalTemplate, :create?
        send_data ::Appraisals::TemplateWorkbook.call,
                  filename: "appraisal-template-format.xlsx",
                  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  disposition: "attachment"
      end

      def activate
        template = find_template
        authorize template, :activate?
        template.update!(status: :active)
        ::Audit::Record.call(action: "appraisal_template.activated", auditable: template, request: request)
        render_data(Api::V1::AppraisalTemplateSerializer.new(template.reload).as_json)
      end

      # Archives rather than destroys: appraisal cycles reference the template
      # they ran against, and deleting the row would leave those pointing at
      # nothing. A template a cycle has actually used is refused outright —
      # hiding it would silently change what a historical cycle reports.
      def destroy
        template = find_template
        authorize template

        if template.appraisal_cycles.exists?
          return render json: {
            errors: [ {
              code: "unprocessable",
              message: "This template has been used by a cycle and can't be deleted. Create a new version instead."
            } ]
          }, status: :unprocessable_content
        end

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
            # The workbook sections the question model has no column for —
            # employee fields, perspectives, development prompts, the final
            # review and the rating guide. Permitted wholesale because it is
            # opaque document structure, not addressable state; nothing reads
            # it back out to make a decision with.
            structure: {},
            categories_attributes: [
              :id, :name, :description, :lens, :weight, :position, :_destroy,
              { questions_attributes: %i[id prompt description position self_rating manager_rating requires_comment required _destroy] }
            ]
          )
        end
    end
  end
end

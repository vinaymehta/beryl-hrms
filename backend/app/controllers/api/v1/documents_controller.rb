module Api
  module V1
    class DocumentsController < Api::V1::BaseController
      def index
        authorize Document
        scope = policy_scope(Document).includes(:employee)
        scope = scope.where(employee_id: params[:employeeId]) if params[:employeeId].present?
        render_data(Api::V1::DocumentSerializer.new(scope.order(created_at: :desc)).as_json)
      end

      def create
        authorize Document
        document = current_company.documents.new(document_params.merge(uploaded_by: Current.user))
        document.save!
        ::Audit::Record.call(action: "document.uploaded", auditable: document, request: request)
        render_data(Api::V1::DocumentSerializer.new(document).as_json, status: :created)
      end

      # GET /api/v1/documents/:id/download — never a public URL: mints a
      # short-expiry signed one fresh, after an explicit Pundit check, on
      # every request (nothing standing is ever handed out in a list/show
      # response — see DocumentSerializer).
      def download
        document = policy_scope(Document).find(params[:id])
        authorize document, :download?

        unless document.file.attached?
          return render json: { errors: [ { code: "not_found", message: "No file attached to this document." } ] },
                         status: :not_found
        end

        ::Audit::Record.call(action: "document.downloaded", auditable: document, request: request)

        # Streamed here rather than redirecting to a presigned storage URL —
        # that URL is built from S3_ENDPOINT (storage as the SERVER sees it),
        # which the browser cannot reach on a deployed box. See the matching
        # comment in Recruitment::ResumesController#download.
        send_data document.file.download,
                  filename: document.file.filename.to_s,
                  type: document.file.content_type.presence || "application/octet-stream",
                  disposition: "attachment"
      end

      def destroy
        document = policy_scope(Document).find(params[:id])
        authorize document
        document.destroy!
        ::Audit::Record.call(action: "document.deleted", auditable: document, request: request)
        head :no_content
      end

      private
        def document_params
          params.permit(:employee_id, :document_type, :title, :file)
        end
    end
  end
end

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

        # Separate from the class-level check above: "may you upload at all" is
        # a property of the user, but "may you upload against THIS employee" is
        # a property of the request. An employee holding only
        # documents.manage_own can file against their own record and nobody
        # else's — without this, the employee_id below would be theirs to pick.
        unless policy(Document).upload_for?(params[:employee_id])
          return render json: { errors: [ { code: "forbidden", message: "You can only upload documents to your own record." } ] },
                        status: :forbidden
        end

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

      # GET /api/v1/documents/:id/preview — the SAME bytes as #download, served
      # to be rendered in the browser instead of saved. See #inline_content_type
      # for why the stored content type alone can't be trusted for this.
      def preview
        document = policy_scope(Document).find(params[:id])
        authorize document, :preview?

        unless document.file.attached?
          return render json: { errors: [ { code: "not_found", message: "No file attached to this document." } ] },
                        status: :not_found
        end

        ::Audit::Record.call(action: "document.previewed", auditable: document, request: request)

        type = inline_content_type(document)

        # Anything we can't safely render is sent as a download even here,
        # rather than inline with a type the browser would refuse or execute.
        allow_app_framing! if type.present?

        send_data document.file.download,
                  filename: document.file.filename.to_s,
                  type: type || "application/octet-stream",
                  disposition: type.present? ? "inline" : "attachment"
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
          params.permit(:employee_id, :document_type, :custom_category, :title, :file)
        end

        # Browsers save an application/octet-stream body however the
        # disposition is spelled, and X-Content-Type-Options: nosniff
        # (config/initializers/security_headers.rb) stops them correcting it by
        # inspecting the bytes. Storage frequently records that generic type
        # for a perfectly ordinary PDF, so the filename decides instead.
        #
        # The allowlist is the point, not a convenience: echoing an arbitrary
        # stored content type back inline would let an uploaded text/html
        # "document" run as script on the API origin. nil means "won't render".
        INLINE_TYPES_BY_EXTENSION = {
          ".pdf" => "application/pdf",
          ".png" => "image/png",
          ".jpg" => "image/jpeg",
          ".jpeg" => "image/jpeg",
          ".gif" => "image/gif",
          ".webp" => "image/webp",
          ".txt" => "text/plain"
        }.freeze

        def inline_content_type(document)
          from_extension = INLINE_TYPES_BY_EXTENSION[File.extname(document.file.filename.to_s).downcase]
          return from_extension if from_extension

          stored = document.file.content_type.presence
          INLINE_TYPES_BY_EXTENSION.value?(stored) ? stored : nil
        end

        # Every response carries X-Frame-Options: DENY, which blocks framing
        # outright — same-origin included — so a preview shown in an <iframe>
        # would render "refused to connect". Only this response opts out, and
        # only for the app's own origins, via frame-ancestors. FRONTEND_ORIGINS
        # is the same list CORS and the CSRF origin check already trust.
        def allow_app_framing!
          origins = FrontendOrigins.all

          response.headers.delete("X-Frame-Options")
          response.headers["Content-Security-Policy"] = "frame-ancestors 'self' #{origins.join(' ')}".strip
        end
    end
  end
end

module Api
  module V1
    module Public
      # PUBLIC, but server-to-server: the careers website's own server
      # forwards each application form here with the shared secret
      # (`Authorization: Bearer <CAREERS_API_KEY>`), so the key never reaches
      # a browser. No session, no cookies, no CSRF — the key is the
      # credential. Throttled in config/initializers/rack_attack.rb.
      #
      # snake_case in and out, like Public::JobOpeningsController. Checked in
      # this order, so nothing about openings is revealed without the key:
      #   503 not configured → 401 bad key → 404 unknown or paused opening →
      #   422 invalid fields → 409 already applied → 201 received
      class JobApplicationsController < Api::V1::BaseController
        allow_unauthenticated_access only: :create
        skip_before_action :set_current_tenant, only: :create
        skip_before_action :ensure_csrf_cookie, only: :create
        skip_before_action :verify_csrf_token, only: :create
        before_action :require_careers_key, only: :create

        rescue_from ::JobApplications::CareersAccess::NotConfigured, with: :render_not_configured

        # POST /api/v1/public/job_openings/:job_opening_slug/applications
        def create
          opening = JobOpening.active.find_by!(slug: params[:job_opening_slug].to_s.downcase)

          result = ActsAsTenant.with_tenant(@company) do
            ::JobApplications::Submit.call(opening: opening, params: params, request_ip: request.remote_ip)
          end

          case result.status
          when :created
            render json: { data: { application_id: result.application.id, status: "received" } }, status: :created
          when :duplicate
            render json: { errors: [ { code: "already_applied", message: "You've already applied for this role." } ] },
                   status: :conflict
          else
            render json: { errors: result.errors }, status: :unprocessable_content
          end
        end

        private
          # Both settings are checked first, so a half-configured server
          # answers 503 whatever is sent.
          def require_careers_key
            @company = ::JobApplications::CareersAccess.company
            token = ::JobApplications::CareersAccess.token_from(request.authorization)
            return if ::JobApplications::CareersAccess.valid_token?(token)

            render json: { errors: [ { code: "unauthorized", message: "Missing or invalid API key." } ] }, status: :unauthorized
          end

          def render_not_configured(exception)
            Rails.logger.error("[careers] application refused: #{exception.message}")
            render json: { errors: [ { code: "not_configured", message: "Applications are not configured." } ] },
                   status: :service_unavailable
          end
      end
    end
  end
end

module Api
  module V1
    class BaseController < ApplicationController
      include Pundit::Authorization
      include CsrfProtection

      before_action :set_current_tenant

      rescue_from Pundit::NotAuthorizedError, with: :render_forbidden
      rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
      rescue_from ActionController::ParameterMissing, with: :render_unprocessable
      rescue_from ActiveRecord::RecordInvalid, with: :render_unprocessable

      private
        # { "data": ... } / { "errors": [...] } envelope, consistently applied
        # here rather than baked into each serializer.
        def render_data(payload, status: :ok)
          render json: { data: payload }, status: status
        end

        # Tenant is resolved from the authenticated user's company. Actions
        # that run before a user has one (register) explicitly wrap their
        # own tenant-scoped work in ActsAsTenant.with_tenant instead of
        # relying on this.
        #
        # Chicken-and-egg otherwise: Current.user resolves through
        # Session#user, a query against the tenant-scoped User table — with
        # no tenant set yet (that's what this method exists to establish),
        # require_tenant would raise on the very lookup meant to set it.
        # Genuinely without_tenant, not a bug: this is the one place a
        # user's own company is allowed to be discovered from their
        # session rather than asserted by an already-known tenant.
        def set_current_tenant
          ActsAsTenant.current_tenant = ActsAsTenant.without_tenant { Current.user&.company }
        end

        def current_company
          Current.company
        end

        # Pundit::Authorization#pundit_user defaults to calling
        # `current_user`, a Devise-style convention this app doesn't use —
        # identity here is Current.user (ActiveSupport::CurrentAttributes).
        # Nothing before the mail/Zoho controllers actually called
        # authorize/policy_scope through a real request (only via direct
        # policy unit tests), so this was never exercised until now.
        def pundit_user
          Current.user
        end

        def render_forbidden
          render json: { errors: [ { code: "forbidden", message: "You are not authorized to perform this action." } ] },
                 status: :forbidden
        end

        def render_not_found
          render json: { errors: [ { code: "not_found", message: "Record not found." } ] }, status: :not_found
        end

        def render_unprocessable(exception)
          record = exception.respond_to?(:record) ? exception.record : nil
          message = record ? record.errors.full_messages.to_sentence : exception.message
          render json: { errors: [ { code: "unprocessable", message: message } ] }, status: :unprocessable_content
        end

        # Structured log enrichment (see config/initializers/lograge.rb).
        # Runs late in the request lifecycle (after the action, as
        # instrumentation is finalized) — by then a destroyed-session
        # Current.session may need to re-resolve its `user` association,
        # which is a tenant-scoped query. This is pure logging metadata, not
        # data served to a client, so it doesn't need tenant enforcement;
        # wrapped defensively rather than letting a log-only lookup 500 an
        # otherwise-successful request.
        def append_info_to_payload(payload)
          super
          ActsAsTenant.without_tenant do
            payload[:company_id] = Current.company&.id
            payload[:user_id] = Current.user&.id
          end
          payload[:request_id] = request.request_id
        end
    end
  end
end

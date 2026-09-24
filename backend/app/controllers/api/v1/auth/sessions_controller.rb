module Api
  module V1
    module Auth
      class SessionsController < Api::V1::BaseController
        allow_unauthenticated_access only: %i[ create ]
        # Signing out must never be blocked by owing a password change.
        allow_pending_password_change only: %i[ destroy_current ]

        # Rails 8's authenticate_by is timing-safe (resists user-enumeration
        # via response-time differences) — login throttling itself is
        # already provided by the framework's built-in rate_limit below.
        rate_limit to: 10, within: 3.minutes, only: :create, with: -> { render_rate_limited }

        def create
          # Identity isn't known yet (that's the point of authenticating),
          # so there's no tenant to scope by until *after* this resolves —
          # every unauthenticated lookup-by-credential/token endpoint in
          # this controller/PasswordsController/EmailVerificationsController
          # follows the same pattern.
          ActsAsTenant.without_tenant do
            user = User.authenticate_by(email_address: params[:email], password: params[:password])

            # An account that has been invited but never set up, or has since
            # been disabled, is not a login. Checked after authenticate_by
            # rather than folded into the lookup so the refusal still costs a
            # password comparison — branching earlier would let someone time
            # the difference and learn which addresses exist.
            if user && !user.sign_in_allowed?
              next render json: { errors: [ { code: "account_not_active", message: sign_in_blocked_message(user) } ] },
                          status: :forbidden
            end

            if user
              start_new_session_for(user)
              ::Audit::Record.call(action: "auth.login", actor: user, company: user.company, request: request)
              render_data(::Auth::MePresenter.call(user))
            else
              render json: { errors: [ { code: "invalid_credentials", message: "Invalid email or password." } ] },
                     status: :unauthorized
            end
          end
        end

        # DELETE /api/v1/auth/logout — destroys the *current* session.
        def destroy_current
          ::Audit::Record.call(action: "auth.logout", actor: Current.user, company: Current.company, request: request)
          terminate_session
          head :no_content
        end

        # GET /api/v1/auth/sessions — list the current user's active sessions.
        def index
          render_data(Api::V1::SessionSerializer.new(Current.user.sessions.active.order(created_at: :desc)).as_json)
        end

        # DELETE /api/v1/auth/sessions/:id — revoke one (may or may not be
        # the current session; revoking the current one has the same effect
        # as /auth/logout).
        def destroy
          session = Current.user.sessions.find(params[:id])
          was_current = session.id == Current.session&.id

          ::Audit::Record.call(action: "auth.session_revoked", actor: Current.user, company: Current.company, auditable: session, request: request)
          session.destroy!
          Current.session = nil if was_current

          head :no_content
        end

        private
          def sign_in_blocked_message(user)
            if user.invited?
              "This account hasn't been set up yet. Open the invitation link sent to your email, " \
                "or ask your administrator to send a new one."
            else
              "This account has been disabled. Contact your administrator."
            end
          end

          def render_rate_limited
            render json: { errors: [ { code: "rate_limited", message: "Too many login attempts. Try again later." } ] },
                   status: :too_many_requests
          end
      end
    end
  end
end

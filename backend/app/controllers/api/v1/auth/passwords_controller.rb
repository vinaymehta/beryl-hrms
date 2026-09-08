module Api
  module V1
    module Auth
      class PasswordsController < Api::V1::BaseController
        allow_unauthenticated_access
        rate_limit to: 10, within: 3.minutes, only: :create, with: -> { render_rate_limited }

        # POST /api/v1/auth/forgot_password — always responds the same way
        # regardless of whether the email exists, so this can't be used to
        # enumerate registered accounts.
        def create
          ActsAsTenant.without_tenant do
            if (user = User.find_by(email_address: params[:email]))
              UserMailer.password_reset(user).deliver_later
            end
          end

          render_data({ message: "If an account exists for that email, password reset instructions have been sent." })
        end

        # POST /api/v1/auth/reset_password
        def update
          ActsAsTenant.without_tenant do
            user = User.find_by_password_reset_token(params[:token])

            unless user
              next render json: { errors: [ { code: "invalid_token", message: "This password reset link is invalid or has expired." } ] },
                          status: :unprocessable_content
            end

            if user.update(password: params[:password], password_confirmation: params[:password_confirmation])
              user.sessions.destroy_all
              ::Audit::Record.call(action: "auth.password_reset", actor: user, company: user.company, auditable: user, request: request)
              render_data({ message: "Password has been reset. Please log in again." })
            else
              render json: { errors: [ { code: "unprocessable", message: user.errors.full_messages.to_sentence } ] },
                     status: :unprocessable_content
            end
          end
        end

        private
          def render_rate_limited
            render json: { errors: [ { code: "rate_limited", message: "Too many attempts. Try again later." } ] },
                   status: :too_many_requests
          end
      end
    end
  end
end

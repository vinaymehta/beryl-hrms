module Api
  module V1
    module Auth
      class EmailVerificationsController < Api::V1::BaseController
        allow_unauthenticated_access

        # POST /api/v1/auth/verify_email
        def create
          ActsAsTenant.without_tenant do
            user = User.find_by_token_for(:email_verification, params[:token])

            unless user
              next render json: { errors: [ { code: "invalid_token", message: "This verification link is invalid or has expired." } ] },
                          status: :unprocessable_content
            end

            user.update!(email_verified_at: Time.current)
            ::Audit::Record.call(action: "auth.email_verified", actor: user, company: user.company, auditable: user, request: request)
            render_data(::Auth::MePresenter.call(user))
          end
        end
      end
    end
  end
end

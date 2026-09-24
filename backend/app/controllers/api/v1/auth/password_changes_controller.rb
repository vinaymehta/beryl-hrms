module Api
  module V1
    module Auth
      # PATCH /api/v1/auth/change_password — authenticated, requires the
      # current password (distinct from the unauthenticated forgot/reset
      # flow in PasswordsController).
      class PasswordChangesController < Api::V1::BaseController
        # The whole point of the forced-change state is to send people here.
        allow_pending_password_change

        def update
          unless Current.user.authenticate(params[:current_password])
            return render json: { errors: [ { code: "invalid_credentials", message: "Current password is incorrect." } ] },
                          status: :unprocessable_content
          end

          if Current.user.update(password: params[:new_password], password_confirmation: params[:new_password_confirmation])
            # Whatever they were required to do, they have now done.
            Current.user.update_column(:must_change_password, false) if Current.user.must_change_password?
            Current.user.sessions.where.not(id: Current.session.id).destroy_all
            ::Audit::Record.call(action: "auth.password_changed", actor: Current.user, company: Current.company, auditable: Current.user, request: request)
            render_data({ message: "Password changed." })
          else
            render json: { errors: [ { code: "unprocessable", message: Current.user.errors.full_messages.to_sentence } ] },
                   status: :unprocessable_content
          end
        end
      end
    end
  end
end

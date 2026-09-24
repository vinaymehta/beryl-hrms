module Api
  module V1
    module Auth
      # The employee's half of the invitation flow: look the link up, then
      # spend it by choosing a password.
      #
      # Unauthenticated by necessity — the whole point is that this person has
      # no way to sign in yet. The token IS the credential, so everything here
      # is written on that basis: it is rate limited, it never says anything
      # about an account it can't verify, and it is spent on first successful
      # use (see User's :invitation generator).
      class InvitationsController < Api::V1::BaseController
        allow_unauthenticated_access
        rate_limit to: 20, within: 3.minutes, only: :show, with: -> { render_rate_limited }
        rate_limit to: 10, within: 3.minutes, only: :create, with: -> { render_rate_limited }

        # GET /api/v1/auth/invitation?token=… — so the page can greet the
        # person by name and show a clear "this link has expired" instead of
        # only failing once they have typed a password twice.
        #
        # Returns the name, address and company on the invitation and nothing
        # else: no id, no roles, no permissions. Somebody holding a token
        # already knows the mailbox it was sent to.
        def show
          with_invited_user do |user|
            render_data({
              email: user.email_address,
              first_name: user.first_name,
              last_name: user.last_name,
              company_name: user.company&.name,
              # Whether Admin ticked "force password update". It decides which
              # of two things this link does: ask them to choose a password,
              # or simply let them in.
              must_set_password: user.must_change_password?
            }.transform_keys { |key| key.to_s.camelize(:lower) })
          end
        end

        # POST /api/v1/auth/accept_invitation — sets the password the employee
        # chose, and signs them straight in.
        #
        # Logging them in here is the "do not immediately force a second
        # password change" requirement: they have just chosen this password, so
        # the account is fully set up and there is nothing left to prompt for.
        def create
          with_invited_user do |user|
            # Two ways to spend an invitation, chosen by what Admin asked for.
            #
            #   forced  — they must choose a password here, and the link is
            #             not accepted without one.
            #   not     — the link itself is the proof of identity (it was
            #             emailed to them and works once), so it just signs
            #             them in. They can set a password later from
            #             Settings, and Forgot password is their way back in
            #             until they do.
            if user.must_change_password?
              if params[:password].blank?
                next render json: { errors: [ { code: "password_required", message: "Choose a password to finish setting up your account." } ] },
                            status: :unprocessable_content
              end
            end

            if params[:password].present? &&
               !user.update(password: params[:password], password_confirmation: params[:password_confirmation])
              next render json: { errors: [ { code: "unprocessable", message: user.errors.full_messages.to_sentence } ] },
                          status: :unprocessable_content
            end

            # Both stamps matter. invitation_accepted_at closes the invitation
            # for good (a second POST with the same token is refused even in
            # the same instant, before the salt change has propagated
            # anywhere); status makes the account signable-in. The address is
            # treated as verified because reaching this line required reading
            # mail sent to it.
            user.update!(
              invitation_accepted_at: Time.current,
              status: :active,
              email_verified_at: user.email_verified_at || Time.current,
              # They have just chosen one, so nothing is outstanding.
              must_change_password: false
            )

            # Nothing should survive from before the password existed.
            user.sessions.destroy_all

            ActsAsTenant.with_tenant(user.company) do
              ::Audit::Record.call(action: "auth.invitation_accepted", actor: user, company: user.company, auditable: user, request: request)
              start_new_session_for(user)
              render_data(::Auth::MePresenter.call(user), status: :created)
            end
          end
        end

        private
          # One place where a token becomes a user, so #show and #create can
          # never disagree about which links are live.
          def with_invited_user
            ActsAsTenant.without_tenant do
              user = User.find_by_token_for(:invitation, params[:token])

              # Deliberately one message for every failure — expired, tampered
              # with, already used, or for an account since disabled. Telling
              # them apart would tell a stranger holding a guessed token which
              # of their guesses named a real account.
              if user.nil? || user.invitation_accepted_at.present? || user.disabled?
                return render json: { errors: [ { code: "invalid_token", message: INVALID_MESSAGE } ] },
                              status: :unprocessable_content
              end

              yield user
            end
          end

          INVALID_MESSAGE = "This invitation link is invalid, has expired, or has already been used. " \
                            "Ask your administrator to send you a new one.".freeze

          def render_rate_limited
            render json: { errors: [ { code: "rate_limited", message: "Too many attempts. Try again later." } ] },
                   status: :too_many_requests
          end
      end
    end
  end
end

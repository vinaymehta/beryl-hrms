module Api
  module V1
    module Auth
      # Self-service company registration: creates a new Company + its
      # first User (Admin role) in one transaction. This is the only
      # self-signup path — additional users within a company are invited
      # by an Admin (a later phase), never open public signup into an
      # existing tenant.
      class RegistrationsController < Api::V1::BaseController
        allow_unauthenticated_access

        def create
          payload = nil

          ActiveRecord::Base.transaction do
            company = Company.create!(name: registration_params[:company_name])

            ActsAsTenant.with_tenant(company) do
              user = company.users.create!(
                email_address: registration_params[:email],
                password: registration_params[:password],
                password_confirmation: registration_params[:password_confirmation],
                first_name: registration_params[:first_name],
                last_name: registration_params[:last_name],
                status: :active
              )

              ::Roles::SeedDefaults.call(company)
              admin_role = company.roles.find_by!(slug: "admin")
              user.user_roles.create!(role: admin_role, company: company)

              UserMailer.email_verification(user).deliver_later
              ::Audit::Record.call(action: "auth.register", actor: user, company: company, auditable: user, request: request)

              # Stays inside with_tenant: MePresenter reads permission_keys,
              # which joins through the tenant-scoped Role model.
              start_new_session_for(user)
              payload = ::Auth::MePresenter.call(user)
            end
          end

          render_data(payload, status: :created)
        end

        private
          def registration_params
            params.permit(:company_name, :first_name, :last_name, :email, :password, :password_confirmation)
          end
      end
    end
  end
end

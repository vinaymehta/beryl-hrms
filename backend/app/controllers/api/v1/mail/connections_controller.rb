module Api
  module V1
    module Mail
      class ConnectionsController < Api::V1::BaseController
        # Zoho redirects the browser here directly — no session cookie is
        # guaranteed relevant at that point, so identity/tenant come
        # entirely from the signed `state` param instead (see
        # Zoho::ConnectionState). Same "resolve tenant without trusting an
        # existing session" shape as the unauthenticated auth endpoints.
        allow_unauthenticated_access only: %i[ callback ]

        def index
          authorize ZohoConnection
          render_data(Api::V1::ZohoConnectionSerializer.new(policy_scope(ZohoConnection).order(:connection_type)).as_json)
        end

        # POST /api/v1/mail/connections/company
        def create_company
          authorize ZohoConnection, :create_company?
          state = ::Zoho::ConnectionState.encode(connection_type: :company_managed, company_id: current_company.id)
          render_data({ authorizationUrl: zoho_client.authorization_url(state: state) })
        end

        # POST /api/v1/mail/connections/individual
        def create_individual
          authorize ZohoConnection, :create_individual?
          state = ::Zoho::ConnectionState.encode(
            connection_type: :individual, company_id: current_company.id, user_id: Current.user.id
          )
          render_data({ authorizationUrl: zoho_client.authorization_url(state: state) })
        end

        # GET /api/v1/mail/connections/callback?code=...&state=...
        def callback
          if params[:error].present?
            Rails.logger.warn("Zoho OAuth returned error parameter: #{params[:error]}")
            return redirect_to_frontend(error: params[:error])
          end

          payload = ::Zoho::ConnectionState.decode(params[:state])
          return redirect_to_frontend(error: "invalid_state") unless payload

          company = ActsAsTenant.without_tenant { Company.find_by(id: payload[:company_id]) }
          return redirect_to_frontend(error: "invalid_state") unless company

          begin
            tokens = zoho_client.exchange_code(code: params[:code])
            account_info = zoho_client.fetch_account_info(access_token: tokens[:access_token])
          rescue ::Zoho::ApiError => e
            Rails.logger.error("Zoho OAuth code exchange failed: #{e.message}")
            return redirect_to_frontend(error: e.message)
          end

          ActsAsTenant.with_tenant(company) do
            user = payload[:user_id].present? ? company.users.find_by(id: payload[:user_id]) : nil

            connection = company.zoho_connections.find_or_initialize_by(
              connection_type: payload[:connection_type], user: user
            )
            connection.assign_attributes(
              access_token: tokens[:access_token],
              refresh_token: tokens[:refresh_token].presence || connection.refresh_token,
              token_expires_at: tokens[:expires_in].to_i.seconds.from_now,
              status: :active,
              email_address: account_info["Email"] || account_info["email"] || connection.email_address || user&.email_address || "mailbox@zoho.com"
            )
            connection.save!

            ::Audit::Record.call(
              action: "zoho.connection_created", actor: user || Current.user, company: company,
              auditable: connection, request: request
            )

            # No date range is asked for or stored at connect time — the
            # Mail page's own filter drives all historical fetching, and
            # ZohoAutoScanJob picks this connection up on its own cadence
            # for new mail without needing any trigger here.
          end

          redirect_to_frontend(connected: true)
        end

        # DELETE /api/v1/mail/connections/:id
        def destroy
          connection = policy_scope(ZohoConnection).find(params[:id])
          authorize connection, :destroy?

          ::Audit::Record.call(
            action: "zoho.connection_revoked", actor: Current.user, company: Current.company,
            auditable: connection, request: request
          )
          connection.destroy!
          head :no_content
        end

        private
          def zoho_client
            @zoho_client ||= ::Zoho::Client.new
          end

          # Destination host is always our own configured frontend origin,
          # never attacker-influenced — allow_other_host is safe here since
          # nothing in the redirect target comes from request params.
          def redirect_to_frontend(**query)
            base = FrontendOrigins.primary
            redirect_to "#{base}/settings/mail?#{query.to_query}", allow_other_host: true
          end
      end
    end
  end
end

module Api
  module V1
    module Calendly
      # Connect / inspect / disconnect the company's Calendly account. Mirrors
      # Api::V1::Mail::ConnectionsController so both integrations behave the
      # same way from the settings UI.
      class ConnectionsController < Api::V1::BaseController
        # The callback is hit by Calendly redirecting the browser, so it cannot
        # depend on a session cookie — the signed `state` carries the tenant.
        allow_unauthenticated_access only: :callback
        skip_before_action :set_current_tenant, only: :callback

        # POST /api/v1/calendly/connections
        def create
          authorize_manage!
          return render_not_configured unless client.configured?

          state = ::Calendly::ConnectionState.encode(
            company_id: Current.company.id, user_id: Current.user&.id
          )
          render json: { data: { authorizationUrl: client.authorization_url(state: state) } }
        end

        # GET /api/v1/calendly/connections
        def index
          authorize_view!
          connection = Current.company.calendly_connections.order(created_at: :desc).first
          render json: { data: connection ? serialize(connection) : nil }
        end

        # GET /api/v1/calendly/connections/callback
        def callback
          return redirect_to_frontend(error: "access_denied") if params[:error].present?

          payload = ::Calendly::ConnectionState.decode(params[:state])
          return redirect_to_frontend(error: "invalid_state") unless payload

          company = ActsAsTenant.without_tenant { Company.find_by(id: payload[:company_id]) }
          return redirect_to_frontend(error: "invalid_state") unless company

          begin
            tokens = client.exchange_code(code: params[:code])
            me = client.current_user(access_token: tokens[:access_token])
          rescue ::Calendly::ApiError => e
            Rails.logger.error("[Calendly] OAuth exchange failed: #{e.message}")
            return redirect_to_frontend(error: e.message)
          end

          ActsAsTenant.with_tenant(company) do
            user = payload[:user_id].present? ? company.users.find_by(id: payload[:user_id]) : nil
            connection = company.calendly_connections.first_or_initialize
            connection.assign_attributes(
              user: user || connection.user,
              access_token: tokens[:access_token],
              refresh_token: tokens[:refresh_token].presence || connection.refresh_token,
              token_expires_at: tokens[:expires_in].to_i.seconds.from_now,
              organization_uri: me["current_organization"] || tokens[:organization],
              calendly_user_uri: me["uri"] || tokens[:owner],
              email_address: me["email"],
              status: :active
            )
            connection.save!

            ::Audit::Record.call(
              action: "calendly.connection_created", actor: user || Current.user, company: company,
              auditable: connection, request: request
            )

            # Subscribe immediately: without this the account is connected but
            # deaf, and no booking would ever change a candidate's status. A
            # failure here does not fail the connect — it is retryable from the
            # settings page, and the UI reports it.
            ::Calendly::WebhookRegistrar.call(connection: connection)
          end

          redirect_to_frontend(connected: true)
        end

        # GET /api/v1/calendly/connections/event_types
        # The bookable event types on the connected account. Their own
        # availability rules are what define the interview slots — we only let
        # the admin choose which one to book against.
        def event_types
          authorize_manage!
          connection = active_connection
          return render json: { data: [] } if connection.nil?

          token = ::Calendly::AccessToken.for(connection)
          types = client.event_types(
            access_token: token,
            organization_uri: connection.organization_uri,
            user_uri: connection.calendly_user_uri
          )
          render json: {
            data: types.map { |t| { uri: t["uri"], name: t["name"], schedulingUrl: t["scheduling_url"], active: t["active"], duration: t["duration"] } }
          }
        rescue ::Calendly::ApiError => e
          render json: { errors: [ { message: e.message } ] }, status: :bad_gateway
        end

        # PATCH /api/v1/calendly/connections/event_type
        def set_event_type
          authorize_manage!
          connection = active_connection
          return render json: { errors: [ { message: "No Calendly account is connected." } ] }, status: :unprocessable_entity if connection.nil?

          connection.update!(default_event_type_uri: params[:event_type_uri])
          render json: { data: serialize(connection) }
        end

        # POST /api/v1/calendly/connections/register_webhook
        # Retry for the case where connecting succeeded but subscribing didn't
        # (Calendly hiccup, or the server wasn't publicly reachable yet).
        def register_webhook
          authorize_manage!
          connection = active_connection
          return render json: { errors: [ { message: "No Calendly account is connected." } ] }, status: :unprocessable_entity if connection.nil?

          result = ::Calendly::WebhookRegistrar.call(connection: connection)
          if result.success?
            render json: { data: serialize(connection.reload) }
          else
            render json: { errors: [ { message: result.error } ] }, status: :bad_gateway
          end
        end

        # DELETE /api/v1/calendly/connections/:id
        def destroy
          authorize_manage!
          connection = Current.company.calendly_connections.find(params[:id])

          ::Audit::Record.call(
            action: "calendly.connection_revoked", actor: Current.user, company: Current.company,
            auditable: connection, request: request
          )
          connection.destroy!
          head :no_content
        end

        private

          def client
            @client ||= ::Calendly::Client.new
          end

          def active_connection
            Current.company.calendly_connections.find_by(status: :active)
          end

          # Reuses the recruitment permissions rather than inventing a new one —
          # scheduling interviews is what this connection is for.
          def authorize_manage!
            return if Current.user&.permission?("recruitment.manage")

            render_forbidden
          end

          def authorize_view!
            return if Current.user&.permission?("recruitment.view") || Current.user&.permission?("recruitment.manage")

            render_forbidden
          end

          # Never exposes the tokens — they are credentials for an external
          # calendar and have no business leaving the server. `ready` is what
          # the UI gates scheduling on: connected is not enough, an event type
          # must be chosen too.
          def serialize(connection)
            {
              id: connection.id.to_s,
              emailAddress: connection.email_address,
              status: connection.status,
              organizationUri: connection.organization_uri,
              defaultEventTypeUri: connection.default_event_type_uri,
              webhookRegistered: connection.webhook_subscription_uri.present?,
              ready: connection.ready?,
              createdAt: connection.created_at.iso8601
            }
          end

          def render_not_configured
            render json: {
              errors: [ { message: "Calendly is not configured on this server (CALENDLY_CLIENT_ID / SECRET / REDIRECT_URI)." } ]
            }, status: :service_unavailable
          end

          # Destination is always our own configured frontend origin — nothing
          # in the target comes from request params.
          def redirect_to_frontend(**query)
            base = FrontendOrigins.primary
            redirect_to "#{base}/settings/interviews?#{query.to_query}", allow_other_host: true
          end
      end
    end
  end
end

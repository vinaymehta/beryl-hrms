module Api
  module V1
    module Mail
      # Shared plumbing for the mail-data endpoints (messages/search): both
      # resolve a connectionId param the same tenant-scoped, permission-
      # checked way, and both need the same Zoho-error-to-HTTP-status
      # mapping — messages/search-specific logic goes in the endpoint's own
      # controller.
      class BaseController < Api::V1::BaseController
        rescue_from ::Zoho::TokenExpiredError, with: :render_zoho_token_expired
        rescue_from ::Zoho::RateLimitedError, with: :render_zoho_rate_limited
        rescue_from ::Zoho::ApiError, with: :render_zoho_error
        rescue_from Faraday::ConnectionFailed, Faraday::TimeoutError, Net::OpenTimeout, with: :render_network_error

        private
          def zoho_client
            @zoho_client ||= ::Zoho::Client.new
          end

          # mail.view is the floor for reading; mail.search additionally
          # required on the search endpoint (checked there, not here).
          def resolve_connection!
            authorize ZohoConnection, :index?
            connection = policy_scope(ZohoConnection).find(params[:connectionId] || params[:connection_id])

            if connection.status != "active"
              render json: { errors: [ { code: "connection_inactive", message: "This mailbox connection needs to be reconnected." } ] },
                     status: :unprocessable_content
              return nil
            end

            # Proactively refresh token if within 5 minutes of expiring or if expired
            if connection.refresh_token.present? && (connection.token_expires_at.nil? || connection.token_expires_at <= Time.current + 5.minutes)
              begin
                tokens = zoho_client.refresh_access_token(refresh_token: connection.refresh_token)
                connection.update!(
                  access_token: tokens[:access_token],
                  token_expires_at: tokens[:expires_in].to_i.seconds.from_now
                )
              rescue => e
                Rails.logger.warn("Auto-refreshing Zoho access token failed: #{e.message}")
              end
            end

            connection
          end

          # Zoho requires an accountId (distinct from our own connection id)
          # for every message-level call — resolved lazily and cached
          # briefly rather than persisted as a new column on ZohoConnection.
          def account_id_for(connection)
            Rails.cache.fetch("zoho_account_id/#{connection.id}", expires_in: 1.hour) do
              zoho_client.fetch_account_id(access_token: connection.access_token)
            end
          end

          def render_zoho_token_expired
            render json: { errors: [ { code: "zoho_token_expired", message: "Reconnect this mailbox to continue." } ] },
                   status: :unauthorized
          end

          def render_zoho_rate_limited
            render json: { errors: [ { code: "zoho_rate_limited", message: "Zoho Mail is temporarily rate-limiting requests. Try again shortly." } ] },
                   status: :too_many_requests
          end

          def render_zoho_error(exception)
            render json: { errors: [ { code: "zoho_api_error", message: exception.message } ] }, status: :bad_gateway
          end

          def render_network_error(exception)
            render json: { errors: [ { code: "zoho_network_timeout", message: "Connection to Zoho Mail timed out. Please try again." } ] }, status: :bad_gateway
          end
      end
    end
  end
end

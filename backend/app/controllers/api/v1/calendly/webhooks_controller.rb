module Api
  module V1
    module Calendly
      # PUBLIC endpoint — Calendly posts here directly, with no session and no
      # tenant. The HMAC signature is the entire authentication, so it is
      # verified before the payload is looked at, and a missing signing key is
      # treated as a hard failure rather than "skip the check".
      class WebhooksController < ApplicationController
        allow_unauthenticated_access only: :create
        skip_forgery_protection if respond_to?(:skip_forgery_protection)

        # Calendly allows a little clock drift; anything older is a replay.
        SIGNATURE_TOLERANCE = 5.minutes

        # POST /api/v1/calendly/webhooks
        def create
          raw_body = request.raw_post

          unless valid_signature?(raw_body)
            Rails.logger.warn("[Calendly] rejected webhook with invalid signature")
            return head :unauthorized
          end

          payload = JSON.parse(raw_body) rescue {}
          outcome = ::Recruitment::CalendlyBookingHandler.call(
            event: payload["event"],
            payload: payload
          )

          Rails.logger.info("[Calendly] webhook #{payload['event'].inspect} -> #{outcome}")

          # Always 200 once authenticated. An unmatched or ignored event is not
          # an error on Calendly's side, and returning non-2xx would make them
          # retry something that will never match.
          head :ok
        rescue => e
          Rails.logger.error("[Calendly] webhook processing failed: #{e.class}: #{e.message}")
          # 500 so Calendly retries a genuine server-side failure.
          head :internal_server_error
        end

        private

          # Calendly-Webhook-Signature: "t=<unix>,v1=<hex hmac of "t.body">".
          def valid_signature?(raw_body)
            key = ENV["CALENDLY_WEBHOOK_SIGNING_KEY"].presence
            if key.blank?
              Rails.logger.error("[Calendly] CALENDLY_WEBHOOK_SIGNING_KEY is not set — refusing webhook")
              return false
            end

            header = request.headers["Calendly-Webhook-Signature"].to_s
            parts = header.split(",").map { |p| p.split("=", 2) }.to_h
            timestamp = parts["t"]
            signature = parts["v1"]
            return false if timestamp.blank? || signature.blank?

            return false if Time.at(timestamp.to_i).utc < SIGNATURE_TOLERANCE.ago

            expected = OpenSSL::HMAC.hexdigest("SHA256", key, "#{timestamp}.#{raw_body}")
            ActiveSupport::SecurityUtils.secure_compare(expected, signature)
          rescue => e
            Rails.logger.warn("[Calendly] signature check errored: #{e.class}: #{e.message}")
            false
          end
      end
    end
  end
end

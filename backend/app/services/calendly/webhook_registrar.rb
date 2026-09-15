module Calendly
  # Subscribes the connected Calendly organisation to invitee.created /
  # invitee.canceled. Without this the whole automation is inert: bookings
  # never set Interview Scheduled and cancellations never reject anyone.
  #
  # Runs on connect, and is idempotent — reconnecting an already-subscribed
  # account does not pile up duplicate subscriptions (which would deliver every
  # event twice).
  class WebhookRegistrar
    def self.call(...) = new(...).call

    def initialize(connection:, client: Client.new)
      @connection = connection
      @client = client
    end

    def call
      url = callback_url
      return failure("Calendly is not configured on this server.") if url.blank?
      return success(@connection.webhook_subscription_uri) if @connection.webhook_subscription_uri.present?

      resource = @client.create_webhook_subscription(
        access_token: AccessToken.for(@connection),
        organization_uri: @connection.organization_uri,
        callback_url: url,
        signing_key: ENV["CALENDLY_WEBHOOK_SIGNING_KEY"].presence
      )
      uri = resource["uri"].presence
      return failure("Calendly did not return a webhook subscription.") if uri.blank?

      @connection.update!(webhook_subscription_uri: uri)
      success(uri)
    rescue ApiError => e
      # Never fails the connect itself: an account that is connected but
      # unsubscribed is recoverable from the UI, whereas losing the tokens
      # would mean starting the OAuth dance again.
      Rails.logger.error("[Calendly] webhook subscription failed for connection #{@connection.id}: #{e.message}")
      failure(e.message)
    end

    # Derived from CALENDLY_REDIRECT_URI rather than being its own env var, so
    # the two can never point at different hosts — a mismatch there is exactly
    # the kind of misconfiguration that looks like "bookings just don't work".
    def self.callback_url_from_env
      redirect = ENV["CALENDLY_REDIRECT_URI"].presence
      return nil if redirect.blank?

      uri = URI.parse(redirect)
      uri.path = "/api/v1/calendly/webhooks"
      uri.query = nil
      uri.to_s
    rescue URI::InvalidURIError
      nil
    end

    private

      def callback_url = self.class.callback_url_from_env

      def success(uri) = Result.new(success?: true, subscription_uri: uri, error: nil)
      def failure(msg) = Result.new(success?: false, subscription_uri: nil, error: msg)

      Result = Struct.new(:success?, :subscription_uri, :error, keyword_init: true)
  end
end

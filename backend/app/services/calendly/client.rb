module Calendly
  # Thin wrapper around Calendly's OAuth 2 + API v2, shaped like Zoho::Client so
  # both integrations read the same way.
  #
  # Nothing here decides scheduling policy: which slots exist, and how many per
  # day, are configured on the Calendly event type itself (Calendly controls
  # availability, per spec). This client only creates booking links against that
  # event type and reads back what was booked.
  class Client
    AUTH_BASE = "https://auth.calendly.com/".freeze
    API_BASE = "https://api.calendly.com/".freeze

    # Every interview is booked and displayed in this zone regardless of where
    # the admin or candidate happens to be.
    TIMEZONE = "Asia/Kolkata".freeze

    def initialize(
      client_id: ENV["CALENDLY_CLIENT_ID"],
      client_secret: ENV["CALENDLY_CLIENT_SECRET"],
      redirect_uri: ENV["CALENDLY_REDIRECT_URI"],
      auth_base_url: ENV.fetch("CALENDLY_AUTH_BASE_URL", AUTH_BASE),
      api_base_url: ENV.fetch("CALENDLY_API_BASE_URL", API_BASE)
    )
      @client_id = client_id
      @client_secret = client_secret
      @redirect_uri = redirect_uri
      @auth_base_url = auth_base_url.to_s.chomp("/") + "/"
      @api_base_url = api_base_url.to_s.chomp("/") + "/"
    end

    def configured?
      @client_id.present? && @client_secret.present? && @redirect_uri.present?
    end

    def authorization_url(state:)
      params = {
        client_id: @client_id,
        response_type: "code",
        redirect_uri: @redirect_uri,
        state: state
      }
      "#{@auth_base_url}oauth/authorize?#{params.to_query}"
    end

    def exchange_code(code:)
      parse_token_response(
        auth_connection.post("oauth/token") do |req|
          req.body = {
            grant_type: "authorization_code",
            client_id: @client_id,
            client_secret: @client_secret,
            redirect_uri: @redirect_uri,
            code: code
          }
        end
      )
    end

    def refresh_access_token(refresh_token:)
      parse_token_response(
        auth_connection.post("oauth/token") do |req|
          req.body = {
            grant_type: "refresh_token",
            client_id: @client_id,
            client_secret: @client_secret,
            refresh_token: refresh_token
          }
        end
      )
    end

    # GET /users/me — identifies the connected account and, crucially, its
    # organization URI, which every other call is scoped by.
    def current_user(access_token:)
      get("users/me", access_token: access_token).dig("resource") || {}
    end

    # The bookable event types on this account. The admin picks one; its own
    # availability rules are what produce the working-day slots.
    def event_types(access_token:, organization_uri:, user_uri: nil)
      params = { organization: organization_uri, active: true, count: 100 }
      params[:user] = user_uri if user_uri.present?
      get("event_types", access_token: access_token, params: params)["collection"] || []
    end

    # A single-use scheduling link: it stops working once booked, which is how
    # "candidate can book once, and cannot reschedule" is enforced at the source
    # rather than by us policing it after the fact.
    def create_scheduling_link(access_token:, event_type_uri:)
      body = { max_event_count: 1, owner: event_type_uri, owner_type: "EventType" }
      post("scheduling_links", access_token: access_token, body: body).dig("resource") || {}
    end

    def scheduled_event(access_token:, event_uri:)
      get(absolute_path(event_uri), access_token: access_token).dig("resource") || {}
    end

    # Subscribe to booking/cancellation. This is what drives the automatic
    # status changes — without it nothing moves to Interview Scheduled.
    def create_webhook_subscription(access_token:, organization_uri:, callback_url:, signing_key: nil)
      body = {
        url: callback_url,
        events: %w[invitee.created invitee.canceled],
        organization: organization_uri,
        scope: "organization"
      }
      body[:signing_key] = signing_key if signing_key.present?
      post("webhook_subscriptions", access_token: access_token, body: body).dig("resource") || {}
    end

    private

      # Calendly returns fully-qualified resource URIs; strip the API base so
      # Faraday resolves them against the configured host (and so a doctored
      # URI from a webhook payload can't redirect us at another origin).
      def absolute_path(uri)
        uri.to_s.sub(@api_base_url, "").sub(API_BASE, "").delete_prefix("/")
      end

      def auth_connection
        @auth_connection ||= Faraday.new(url: @auth_base_url) do |f|
          f.request :url_encoded
          f.adapter Faraday.default_adapter
          f.options.timeout = 15
          f.options.open_timeout = 5
        end
      end

      def api_connection(access_token)
        Faraday.new(url: @api_base_url) do |f|
          f.request :json
          f.headers["Authorization"] = "Bearer #{access_token}"
          f.adapter Faraday.default_adapter
          f.options.timeout = 15
          f.options.open_timeout = 5
        end
      end

      def get(path, access_token:, params: {})
        handle(api_connection(access_token).get(path, params))
      end

      def post(path, access_token:, body:)
        handle(api_connection(access_token).post(path) { |req| req.body = body })
      end

      def handle(response)
        raise TokenExpiredError, "Calendly access token rejected" if response.status == 401

        unless response.success?
          raise ApiError, "Calendly API error (#{response.status}): #{truncate_body(response.body)}"
        end

        parse_json(response.body)
      end

      def parse_token_response(response)
        unless response.success?
          raise ApiError, "Calendly OAuth error (#{response.status}): #{truncate_body(response.body)}"
        end

        data = parse_json(response.body)
        {
          access_token: data["access_token"],
          refresh_token: data["refresh_token"],
          expires_in: data["expires_in"],
          owner: data["owner"],
          organization: data["organization"]
        }
      end

      def parse_json(body)
        return body if body.is_a?(Hash)

        JSON.parse(body.to_s.presence || "{}")
      rescue JSON::ParserError
        {}
      end

      # Error bodies go into logs and audit trails; keep them bounded and never
      # echo a whole API response back.
      def truncate_body(body)
        body.to_s[0, 300]
      end
  end
end

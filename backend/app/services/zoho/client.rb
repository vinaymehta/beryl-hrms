module Zoho

  # Thin wrapper around Zoho's OAuth v2 + Mail API v1.
  class Client
    OAUTH_SCOPE = "ZohoMail.accounts.ALL,ZohoMail.messages.ALL,ZohoMail.folders.ALL,AaaServer.profile.READ".freeze

    def initialize(
      client_id: ENV.fetch("ZOHO_CLIENT_ID", nil),
      client_secret: ENV.fetch("ZOHO_CLIENT_SECRET", nil),
      redirect_uri: ENV.fetch("ZOHO_REDIRECT_URI", nil),
      accounts_base_url: ENV.fetch("ZOHO_ACCOUNTS_BASE_URL", "https://accounts.zoho.com"),
      api_base_url: ENV.fetch("ZOHO_API_BASE_URL", "https://mail.zoho.com/api")
    )
      @client_id = client_id
      @client_secret = client_secret
      @redirect_uri = redirect_uri
      # Ensure base URLs end with / so Faraday resolves relative paths correctly without stripping /api
      @accounts_base_url = (accounts_base_url || "https://accounts.zoho.com").chomp("/") + "/"
      @api_base_url = (api_base_url || "https://mail.zoho.com/api").chomp("/") + "/"
    end

    def authorization_url(state:)
      params = {
        response_type: "code",
        client_id: @client_id,
        scope: OAUTH_SCOPE,
        redirect_uri: @redirect_uri,
        access_type: "offline",
        prompt: "consent",
        state: state
      }
      "#{@accounts_base_url}oauth/v2/auth?#{params.to_query}"
    end

    def exchange_code(code:)
      parse_token_response(
        accounts_connection.post("oauth/v2/token") do |req|
          req.body = {
            grant_type: "authorization_code", client_id: @client_id, client_secret: @client_secret,
            redirect_uri: @redirect_uri, code: code
          }
        end
      )
    end

    def refresh_access_token(refresh_token:)
      parse_token_response(
        accounts_connection.post("oauth/v2/token") do |req|
          req.body = {
            grant_type: "refresh_token", client_id: @client_id, client_secret: @client_secret,
            refresh_token: refresh_token
          }
        end
      )
    end

    # Basic profile info for the connected mailbox (used once, right after
    # exchange_code, to populate ZohoConnection#email_address).
    def fetch_account_info(access_token:)
      # First try Zoho Mail /accounts which is guaranteed by ZohoMail.accounts.READ
      begin
        body = parse_response(authenticated_api_connection(access_token).get("accounts"))
        first_acc = Array(body["data"]).first
        email = first_acc&.dig("primaryEmailAddress") ||
                first_acc&.dig("mailboxAddress") ||
                first_acc&.dig("incomingUserName") ||
                first_acc&.dig("accountName")
        return { "Email" => email, "accountId" => first_acc&.dig("accountId") } if email.present?
      rescue => e
        Rails.logger.warn("Could not fetch mail /accounts: #{e.message}")
      end

      # Fallback to Zoho Accounts /oauth/user/info if profile scope is available
      begin
        body = parse_response(authenticated_accounts_connection(access_token).get("oauth/user/info"))
        return body if body["Email"].present? || body["email"].present?
      rescue => e
        Rails.logger.warn("Could not fetch oauth user info: #{e.message}")
      end

      { "Email" => nil }
    end

    # Zoho requires accountId for message calls
    def fetch_account_id(access_token:)
      body = parse_response(authenticated_api_connection(access_token).get("accounts"))
      first_acc = Array(body["data"]).first
      first_acc&.dig("accountId") or raise ApiError.new("No mail account found for user")
    end

    def list_messages(access_token:, account_id:, folder: "inbox", folder_id: nil, page: 1, limit: 25)
      start = (page - 1) * limit + 1
      if folder_id.present?
        parse_response(
          authenticated_api_connection(access_token).get(
            "accounts/#{account_id}/messages/view",
            { folderId: folder_id, start: start, limit: limit }
          )
        )
      else
        query = folder.present? ? "in:\"#{folder}\"" : "in:inbox"
        search_messages(access_token: access_token, account_id: account_id, query: query, page: page, limit: limit)
      end
    end

    def get_message(access_token:, account_id:, message_id:, folder_id: nil)
      if folder_id.blank?
        begin
          search_res = parse_response(
            authenticated_api_connection(access_token).get(
              "accounts/#{account_id}/messages/search",
              { searchKey: "mid:#{message_id}" }
            )
          )
          meta = Array(search_res["data"]).first || { "messageId" => message_id }
          folder_id = meta["folderId"]
        rescue => e
          Rails.logger.warn("Could not find folderId via mid search: #{e.message}")
          meta = { "messageId" => message_id }
        end
      else
        meta = { "messageId" => message_id, "folderId" => folder_id }
      end

      content = meta["summary"] || ""
      attachments = []

      if folder_id.present?
        begin
          content_res = parse_response(
            authenticated_api_connection(access_token).get(
              "accounts/#{account_id}/folders/#{folder_id}/messages/#{message_id}/content"
            )
          )
          content = content_res.dig("data", "content") || content
        rescue => e
          Rails.logger.warn("Could not fetch message content: #{e.message}")
        end

        begin
          att_res = parse_response(
            authenticated_api_connection(access_token).get(
              "accounts/#{account_id}/folders/#{folder_id}/messages/#{message_id}/attachmentinfo"
            )
          )
          raw_atts = Array(att_res.dig("data", "attachments"))
          attachments = raw_atts.map do |a|
            {
              id: a["attachmentId"].to_s,
              name: a["attachmentName"] || "attachment",
              size: a["attachmentSize"].to_i
            }
          end
        rescue => e
          Rails.logger.warn("Could not fetch attachment info: #{e.message}")
        end
      end

      meta.merge("content" => content, "attachments" => attachments)
    end

    def mark_as_read(access_token:, account_id:, message_id:, read: true)
      mode = read ? "markAsRead" : "markAsUnread"
      res = authenticated_api_connection(access_token).put("accounts/#{account_id}/updatemessage") do |req|
        req.headers["Content-Type"] = "application/json"
        req.body = { mode: mode, messageId: [message_id.to_s] }.to_json
      end
      parse_response(res)
    end

    def delete_message(access_token:, account_id:, message_id:, folder_id: nil)
      if folder_id.blank?
        begin
          search_res = parse_response(
            authenticated_api_connection(access_token).get(
              "accounts/#{account_id}/messages/search",
              { searchKey: "mid:#{message_id}" }
            )
          )
          meta = Array(search_res["data"]).first || {}
          folder_id = meta["folderId"]
        rescue => e
          Rails.logger.warn("Could not find folderId for delete: #{e.message}")
        end
      end

      if folder_id.present?
        res = authenticated_api_connection(access_token).delete("accounts/#{account_id}/folders/#{folder_id}/messages/#{message_id}")
        parse_response(res)
      else
        raise ApiError.new("Folder not found for message #{message_id}")
      end
    end

    def send_message(access_token:, account_id:, from_address:, to_address:, subject:, content:, cc_address: nil, bcc_address: nil)
      payload = {
        fromAddress: from_address,
        toAddress: to_address,
        subject: subject.presence || "(no subject)",
        content: content.to_s,
        mailFormat: "html"
      }
      payload[:ccAddress] = cc_address if cc_address.present?
      payload[:bccAddress] = bcc_address if bcc_address.present?

      res = authenticated_api_connection(access_token).post("accounts/#{account_id}/messages") do |req|
        req.headers["Content-Type"] = "application/json"
        req.body = payload.to_json
      end
      parse_response(res)
    end

    def fetch_folders(access_token:, account_id:)
      res = authenticated_api_connection(access_token).get("accounts/#{account_id}/folders")
      body = parse_response(res)
      Array(body["data"]).map do |f|
        {
          id: f["folderId"].to_s,
          name: f["folderName"].to_s,
          path: f["folderPath"].to_s,
          unreadCount: f["unreadCount"].to_i,
          totalCount: (f["messageCount"] || f["totalCount"]).to_i
        }
      end
    end

    def fetch_stats(access_token:, account_id:, refresh: false)
      cache_key = "zoho_mail_stats_#{account_id}"
      Rails.cache.delete(cache_key) if refresh

      Rails.cache.fetch(cache_key, expires_in: 45.seconds) do
        acc_res = parse_response(authenticated_api_connection(access_token).get("accounts"))
        first_acc = Array(acc_res["data"]).first || {}

        folders = begin
          fetch_folders(access_token: access_token, account_id: account_id)
        rescue => e
          Rails.logger.warn("Could not fetch folders for stats: #{e.message}")
          []
        end

        # Fetch live unread messages across the account
        unread_by_folder = {}
        total_unread = 0
        begin
          unread_res = parse_response(
            authenticated_api_connection(access_token).get("accounts/#{account_id}/messages/view", { status: "unread", limit: 200 })
          )
          unread_msgs = Array(unread_res["data"])
          total_unread = unread_msgs.size
          unread_by_folder = unread_msgs.group_by { |m| m["folderId"].to_s }.transform_values(&:size)
        rescue => e
          Rails.logger.warn("Could not fetch unread messages for stats: #{e.message}")
        end

        # Count messages for core folders concurrently
        target_names = %w[inbox sent drafts trash spam templates]
        target_folders = folders.select { |f| target_names.include?(f[:name].to_s.downcase) }
        counts = {}

        threads = target_folders.map do |f|
          Thread.new do
            begin
              res = authenticated_api_connection(access_token).get("accounts/#{account_id}/messages/view", { folderId: f[:id], limit: 200 })
              data = Array(parse_response(res)["data"])
              counts[f[:id]] = data.size
            rescue => e
              counts[f[:id]] = 0
            end
          end
        end
        threads.each { |t| t.join(10) }

        folders.each do |f|
          f[:unreadCount] = unread_by_folder[f[:id]] || 0
          f[:totalCount] = counts[f[:id]] || 0
        end

        inbox_folder = folders.find { |f| f[:name].to_s.casecmp?("inbox") } || {}
        sent_folder = folders.find { |f| f[:name].to_s.casecmp?("sent") } || {}
        drafts_folder = folders.find { |f| f[:name].to_s.casecmp?("drafts") } || {}
        trash_folder = folders.find { |f| f[:name].to_s.casecmp?("trash") } || {}
        spam_folder = folders.find { |f| f[:name].to_s.casecmp?("spam") } || {}

        {
          accountId: account_id,
          emailAddress: first_acc["primaryEmailAddress"] || first_acc["mailboxAddress"] || "",
          displayName: first_acc["displayName"] || first_acc["accountName"] || "",
          status: first_acc["accountStatus"] || (first_acc["status"] ? "active" : "inactive"),
          totalMessages: folders.sum { |f| f[:totalCount] },
          totalUnread: total_unread,
          inboxCount: inbox_folder[:totalCount].to_i,
          inboxUnread: inbox_folder[:unreadCount].to_i,
          sentCount: sent_folder[:totalCount].to_i,
          draftsCount: drafts_folder[:totalCount].to_i,
          trashCount: trash_folder[:totalCount].to_i,
          spamCount: spam_folder[:totalCount].to_i,
          folders: folders
        }
      end
    end

    def download_attachment(access_token:, account_id:, message_id:, attachment_id:)
      search_res = parse_response(
        authenticated_api_connection(access_token).get(
          "accounts/#{account_id}/messages/search",
          { searchKey: "mid:#{message_id}" }
        )
      )
      meta = Array(search_res["data"]).first || {}
      folder_id = meta["folderId"]

      res = authenticated_api_connection(access_token).get(
        "accounts/#{account_id}/folders/#{folder_id}/messages/#{message_id}/attachments/#{attachment_id}"
      )

      filename = "attachment"
      if res.headers["content-disposition"] =~ /filename\s*=\s*"?([^";]+)"?/i
        filename = $1.strip
      end

      {
        body: res.body,
        filename: filename,
        content_type: res.headers["content-type"] || "application/octet-stream"
      }
    end

    def search_messages(access_token:, account_id:, query:, page: 1, limit: 25)
      start = (page - 1) * limit + 1
      parse_response(
        authenticated_api_connection(access_token).get(
          "accounts/#{account_id}/messages/search",
          { searchKey: query, start: start, limit: limit }
        )
      )
    end

    private
      def accounts_connection
        @accounts_connection ||= build_connection(@accounts_base_url)
      end

      def authenticated_accounts_connection(access_token)
        build_connection(@accounts_base_url) { |c| c.headers["Authorization"] = "Zoho-oauthtoken #{access_token}" }
      end

      def authenticated_api_connection(access_token)
        build_connection(@api_base_url) { |c| c.headers["Authorization"] = "Zoho-oauthtoken #{access_token}" }
      end

      def build_connection(url)
        Faraday.new(url: url) do |conn|
          conn.request :url_encoded
          conn.request :retry, max: 2, interval: 0.25, retry_statuses: [ 502, 503, 504 ]
          conn.options.timeout = 25
          conn.options.open_timeout = 15
          yield conn if block_given?
        end
      end

      def parse_token_response(response)
        body = parse_response(response)
        if body.is_a?(Hash) && body["error"].present?
          desc = body["error_description"] || body["message"] || body["error"]
          raise ApiError.new("Zoho token error: #{desc}")
        end
        { access_token: body["access_token"], refresh_token: body["refresh_token"], expires_in: body["expires_in"] }
      end

      def parse_response(response)
        body = response.body.is_a?(String) ? (JSON.parse(response.body) rescue {}) : (response.body || {})

        if body.is_a?(Hash) && body["error"].present? && response.status.between?(200, 299)
          desc = body["error_description"] || body["message"] || body["error"]
          raise ApiError.new("Zoho error: #{desc}", status: response.status)
        end

        case response.status
        when 200..299 then body
        when 401 then raise TokenExpiredError.new("Zoho access token expired or revoked", status: 401)
        when 429 then raise RateLimitedError.new("Zoho API rate limit exceeded", status: 429)
        else
          Rails.logger.error("Zoho API error (HTTP #{response.status}): #{response.body.to_s.truncate(1000)}")
          raise ApiError.new("Zoho API error: #{body['message'] || body['error'] || response.status}", status: response.status)
        end
      end
  end
end

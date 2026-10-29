require "digest"

module Recruitment
  # The Zoho half of a candidate's email timeline (the resume panel's Emails
  # tab): every message to or from the candidate's address in each of the
  # given mailboxes, plus the email the resume itself arrived in.
  #
  # Nothing is stored — the mailboxes are searched live, with each mailbox's
  # result cached briefly so flipping between tabs or reopening the panel
  # doesn't hit Zoho again. Mail the APP sent (RecruitmentEmail) is the other
  # half and is merged in by the controller, not here.
  #
  # One mailbox failing never fails the whole timeline: it is reported in
  # `accounts` with a status the panel turns into a warning, and the other
  # mailboxes' messages are still returned.
  class CandidateMailHistory
    SEARCH_TTL = 60.seconds
    # The original-application lookup is by message id, which never changes
    # meaning, so it can be kept much longer than the address search.
    SOURCE_TTL = 1.hour
    # Per mailbox and per direction. A candidate conversation is a handful of
    # messages; this is a ceiling, not a page size.
    SEARCH_LIMIT = 50

    Result = Struct.new(:accounts, :items, keyword_init: true)

    # connections: every mailbox the viewer may see, active or not — an
    # inactive one is reported as needing a reconnect rather than dropped.
    # original_email_ids: Zoho message ids the candidate's resumes arrived in
    # (candidate_resumes.source_email_id); those messages are marked, and
    # fetched by id when the address search doesn't already include them
    # (a resume forwarded by someone else, or sent from another address).
    def initialize(connections:, address:, original_email_ids: [], client: ::Zoho::Client.new)
      @connections = connections
      @address = address.to_s.strip.downcase.presence
      @original_email_ids = original_email_ids.compact_blank.map(&:to_s).uniq
      @client = client
    end

    def call
      accounts = []
      items = []

      @connections.each do |connection|
        unless connection.active?
          accounts << account(connection, "reconnect_required", "This mailbox needs to be reconnected.")
          next
        end

        folders = folder_names(connection)
        items.concat(messages_for(connection).map { |raw| item(connection, raw, folders) })
        accounts << account(connection, "ok")
      rescue ::Zoho::TokenExpiredError
        accounts << account(connection, "reconnect_required", "This mailbox needs to be reconnected.")
      rescue ::Zoho::RateLimitedError
        accounts << account(connection, "error", "Zoho Mail is rate-limiting requests. Try again shortly.")
      rescue ::Zoho::ApiError, Faraday::Error, Net::OpenTimeout => e
        Rails.logger.warn("[CandidateMailHistory] searching connection #{connection.id} failed: #{e.class}: #{e.message}")
        accounts << account(connection, "error", "Couldn't search this mailbox right now.")
      end

      Result.new(accounts: accounts, items: items)
    end

    # The raw Zoho summary of one message in this candidate's conversation in
    # this mailbox, or nil. The message endpoint opens only what this returns,
    # so a resume viewer can't use it to read arbitrary mail by id.
    def find(connection, message_id)
      messages_for(connection).find { |raw| raw["messageId"].to_s == message_id.to_s }
    end

    private
      def account(connection, status, error = nil)
        { connectionId: connection.id.to_s, email: connection.email_address, status: status, error: error }.compact
      end

      def mailbox(connection)
        @mailboxes ||= {}
        @mailboxes[connection.id] ||= ::Zoho::Mailbox.new(connection, client: @client)
      end

      # Address search, then any original-application email it missed.
      def messages_for(connection)
        @messages ||= {}
        @messages[connection.id] ||= begin
          found = address_messages(connection)
          known = found.map { |raw| raw["messageId"].to_s }
          missing = @original_email_ids - known
          found + missing.filter_map { |id| original_message(connection, id) }
        end
      end

      # Two searches rather than one OR'd query: `sender:` and `to:` are the
      # plainest, documented forms of Zoho's searchKey. Merged by message id —
      # mail the candidate sent to themselves would otherwise appear twice.
      def address_messages(connection)
        return [] unless @address

        key = "recruitment_mail_history/#{connection.id}/#{Digest::SHA256.hexdigest(@address)}"
        Rails.cache.fetch(key, expires_in: SEARCH_TTL) do
          %w[sender to].flat_map { |field| search(connection, "#{field}:#{@address}") }
                       .uniq { |raw| raw["messageId"].to_s }
        end
      end

      # The message, or nil when it isn't in this mailbox — the resume doesn't
      # record which mailbox it came from. The id is checked on the way out:
      # Zoho's mid: search has been seen answering with a different message
      # (see Api::V1::Mail::MessagesController#show).
      def original_message(connection, message_id)
        Rails.cache.fetch("recruitment_mail_original/#{connection.id}/#{message_id}", expires_in: SOURCE_TTL) do
          search(connection, "mid:#{message_id}").find { |raw| raw["messageId"].to_s == message_id }
        end
      end

      def search(connection, query)
        mb = mailbox(connection)
        body = @client.search_messages(
          access_token: mb.access_token, account_id: mb.account_id, query: query, limit: SEARCH_LIMIT
        )
        Array(body["data"])
      end

      # Folder names are a nicety — a failed lookup leaves them blank rather
      # than failing the mailbox. (fetch_folders caches on its own.)
      def folder_names(connection)
        mb = mailbox(connection)
        @client.fetch_folders(access_token: mb.access_token, account_id: mb.account_id)
               .to_h { |f| [ f[:id], f[:name] ] }
      rescue ::Zoho::ApiError, Faraday::Error => e
        Rails.logger.warn("[CandidateMailHistory] folders for connection #{connection.id}: #{e.message}")
        {}
      end

      def item(connection, raw, folders)
        summary = ::Zoho::MessagePresenter.summary(raw)
        {
          source: "zoho",
          id: summary[:id],
          connectionId: connection.id.to_s,
          accountEmail: connection.email_address,
          folderId: summary[:folderId],
          folder: folders[summary[:folderId]],
          # Judged against the mailbox's own address rather than the
          # candidate's, so a forwarded application still reads as received.
          direction: summary[:from].downcase.include?(connection.email_address.to_s.downcase) ? "sent" : "received",
          from: summary[:from],
          to: summary[:to],
          subject: summary[:subject],
          date: summary[:receivedAt],
          snippet: summary[:snippet],
          hasAttachments: summary[:hasAttachment],
          isOriginalApplication: @original_email_ids.include?(summary[:id])
        }
      end
  end
end

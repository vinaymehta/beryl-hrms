module Mail
  # Walks a folder's real messages from Zoho and returns only the ones
  # received within a given date range — for DISPLAY in the Mail Dashboard
  # message list, not for import. This is deliberately the read-only
  # counterpart to Recruitment::ZohoMailScanner: same pagination and
  # early-stop logic (inbox is newest-first, so a page entirely older than
  # the range means nothing further back is in range either), but it
  # returns raw message hashes for the caller to present, and never creates
  # a CandidateResume or touches any historical-fetch/auto-scan state —
  # picking a range here is a live view of the mailbox, not a background
  # job trigger.
  class DateFilteredMessages
    # Shared with Mail::ScopedStats so the list and the KPI cards can never
    # report different totals for the same filter — see Mail::ScanBounds.
    MAX_PAGES = ScanBounds::MAX_PAGES
    PAGE_SIZE = ScanBounds::PAGE_SIZE
    MAX_RESULTS = ScanBounds::MAX_RESULTS

    Result = Struct.new(:messages, :capped, keyword_init: true)

    def self.call(...) = new(...).call

    def initialize(zoho_client:, access_token:, account_id:, folder:, folder_id:, from:, to:)
      @zoho_client = zoho_client
      @access_token = access_token
      @account_id = account_id
      @folder = folder
      @folder_id = folder_id
      @range_start = from
      @range_end = to
    end

    def call
      matched = []
      capped = false
      # Resolved once, up front, to a real folderId — Zoho::Client#list_messages
      # falls back to a `search_messages(query: "in:\"<folder>\"")` call when
      # given a folder name with no id, and that search endpoint has been
      # observed returning a meaningfully different (larger) result set than
      # the direct folderId view Mail::ScopedStats always uses for the same
      # window. Resolving to a real id here keeps the message list and the
      # KPI/stats cards counting from the exact same source.
      folder_id = @folder_id.presence || resolve_folder_id

      MAX_PAGES.times do |page_index|
        resp = @zoho_client.list_messages(
          access_token: @access_token,
          account_id: @account_id,
          folder: @folder,
          folder_id: folder_id,
          page: page_index + 1,
          limit: PAGE_SIZE
        )
        messages = Array(resp["data"])
        break if messages.empty?

        oldest_on_page = nil
        messages.each do |msg|
          received = received_at(msg)
          oldest_on_page = received if oldest_on_page.nil? || received < oldest_on_page
          matched << msg if received.between?(@range_start, @range_end)
        end

        if matched.size >= MAX_RESULTS
          capped = true
          break
        end

        # Stop as soon as a page reaches back past the range: listings are
        # newest-first, so every later page is older still and cannot hold
        # anything in range. Tested against the page's OLDEST message
        # rather than requiring the whole page to be older — the latter
        # almost never fires on a large page (a page spanning the boundary
        # holds both in-range and older mail), which forced an extra
        # round trip per request for no reason.
        break if oldest_on_page && oldest_on_page < @range_start

        capped = true if page_index == MAX_PAGES - 1
      end

      Result.new(messages: matched.first(MAX_RESULTS), capped: capped)
    end

    private

    def resolve_folder_id
      folders = @zoho_client.fetch_folders(access_token: @access_token, account_id: @account_id)
      folders.find { |f| f[:name].to_s.casecmp?(@folder.to_s) }&.dig(:id)
    rescue => e
      Rails.logger.warn("[Mail::DateFilteredMessages] could not resolve folder id for #{@folder.inspect}: #{e.message}")
      nil
    end

    def received_at(msg)
      ms = msg["receivedTime"].to_i
      ms > 0 ? Time.at(ms / 1000.0) : Time.current
    end
  end
end

module Mail
  # Recomputes the "Total Emails/Unread/Inbox/Sent/Drafts" KPI numbers from
  # only the messages actually received in the range the Mail page's date
  # filter selected — not Zoho's whole-account stats. So with the filter on
  # "Last Week", the cards describe that week and agree exactly with the
  # message list the same filter produced.
  #
  # Same walk-and-filter approach as Mail::DateFilteredMessages (per
  # folder, newest-first, stop once a page is entirely older than the
  # range) — Zoho gives no cheaper way to count messages within a range.
  # Bounded the same honest way: hitting the cap means "at least this
  # many", surfaced via the *Capped flags, matching Zoho::Client's own
  # COUNT_CAP convention for the unscoped stats this replaces.
  class ScopedStats
    FOLDER_NAMES = %w[inbox sent drafts trash spam].freeze
    # Shared with Mail::DateFilteredMessages so the KPI cards and the
    # message list can never report different totals for the same filter —
    # see Mail::ScanBounds.
    MAX_PAGES = ScanBounds::MAX_PAGES
    PAGE_SIZE = ScanBounds::PAGE_SIZE
    COUNT_CAP = ScanBounds::MAX_RESULTS

    def self.call(...) = new(...).call

    def initialize(zoho_client:, access_token:, account_id:, from:, to:)
      @zoho_client = zoho_client
      @access_token = access_token
      @account_id = account_id
      @range_start = from
      @range_end = to
    end

    def call
      folders = @zoho_client.fetch_folders(access_token: @access_token, account_id: @account_id)
      by_name = {}

      # Walked concurrently: each folder's pagination is independent, and
      # run sequentially these five walks dominated the whole request
      # (~12s of a ~22s page load). Same threading shape Zoho::Client's own
      # fetch_stats uses for its per-folder counts.
      threads = FOLDER_NAMES.map do |name|
        folder = folders.find { |f| f[:name].to_s.casecmp?(name) }
        next by_name[name] = { count: 0, unread: 0, capped: false } unless folder

        Thread.new do
          by_name[name] = begin
            count_folder(folder[:id])
          rescue => e
            Rails.logger.warn("[Mail::ScopedStats] #{name} count failed: #{e.class}: #{e.message}")
            { count: 0, unread: 0, capped: false }
          end
        end
      end
      threads.each { |t| t.join(30) if t.is_a?(Thread) }

      inbox = by_name["inbox"]
      sent = by_name["sent"]
      drafts = by_name["drafts"]
      trash = by_name["trash"]
      spam = by_name["spam"]
      total_unread = by_name.values.sum { |v| v[:unread] }

      {
        totalMessages: by_name.values.sum { |v| v[:count] },
        totalMessagesCapped: by_name.values.any? { |v| v[:capped] },
        totalUnread: total_unread,
        totalUnreadCapped: by_name.values.any? { |v| v[:capped] },
        inboxCount: inbox[:count],
        inboxCountCapped: inbox[:capped],
        inboxUnread: inbox[:unread],
        sentCount: sent[:count],
        sentCountCapped: sent[:capped],
        draftsCount: drafts[:count],
        draftsCountCapped: drafts[:capped],
        trashCount: trash[:count],
        spamCount: spam[:count],
        folders: folders.map do |f|
          counted = by_name[f[:name].to_s.downcase]
          counted ? f.merge(totalCount: counted[:count], unreadCount: counted[:unread], totalCountCapped: counted[:capped]) : f
        end
      }
    end

    private

    def count_folder(folder_id)
      matched = 0
      unread = 0
      capped = false

      MAX_PAGES.times do |page_index|
        resp = @zoho_client.list_messages(
          access_token: @access_token, account_id: @account_id,
          folder_id: folder_id, page: page_index + 1, limit: PAGE_SIZE
        )
        messages = Array(resp["data"])
        break if messages.empty?

        oldest_on_page = nil
        messages.each do |msg|
          received = received_at(msg)
          oldest_on_page = received if oldest_on_page.nil? || received < oldest_on_page
          next unless received.between?(@range_start, @range_end)

          matched += 1
          unread += 1 unless msg["status"].to_s == "1"
        end

        if matched >= COUNT_CAP
          capped = true
          break
        end

        # Same early stop as Mail::DateFilteredMessages — keyed on the
        # page's oldest message, so a page that straddles the range start
        # ends the walk instead of triggering another round trip.
        break if oldest_on_page && oldest_on_page < @range_start

        capped = true if page_index == MAX_PAGES - 1
      end

      { count: matched, unread: unread, capped: capped }
    end

    def received_at(msg)
      ms = msg["receivedTime"].to_i
      ms > 0 ? Time.at(ms / 1000.0) : Time.current
    end
  end
end

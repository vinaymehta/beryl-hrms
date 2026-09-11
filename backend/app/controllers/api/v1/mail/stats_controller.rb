module Api
  module V1
    module Mail
      class StatsController < Api::V1::Mail::BaseController
        # GET /api/v1/mail/stats?connectionId=...&dateFrom=...&dateTo=...
        # With a range, every count describes only that range, so the KPI
        # cards always agree with the message list the same filter produced.
        # Without one, they describe the whole mailbox.
        def show
          connection = resolve_connection!
          return unless connection

          refresh = params[:refresh].to_s == "true"
          account_id = account_id_for(connection)
          date_from = parse_filter_date(params[:dateFrom])
          date_to = parse_filter_date(params[:dateTo])

          stats =
            if date_from && date_to
              # Scoped: fetch_stats is skipped entirely. It spends ~5s
              # computing whole-mailbox counts (its own per-folder walks and
              # an unread search) that this path then discards wholesale —
              # every count comes from ScopedStats instead, and the only
              # non-count field the UI reads is the address, which it can
              # take straight off the connection.
              scoped_counts(connection, account_id, date_from, date_to, refresh)
                .merge(accountId: account_id, emailAddress: connection.email_address)
            else
              zoho_client.fetch_stats(access_token: connection.access_token, account_id: account_id, refresh: refresh)
            end

          render_data(stats)
        end

        private

        def parse_filter_date(value)
          return nil if value.blank?

          Date.parse(value.to_s)
        rescue ArgumentError
          nil
        end

        # Replaces only fetch_stats's count fields — the account metadata
        # (emailAddress, accountId, ...) it returned is kept as-is.
        #
        # Cached only briefly, and deliberately shorter than the Mail page's
        # poll interval: the message list is uncached, so a longer-lived
        # entry here meant a poll could pair a live list (showing newly
        # arrived mail) with a pre-arrival Unread count. Short enough that
        # every poll re-walks, long enough to absorb duplicate/burst
        # requests from a remount.
        SCOPED_STATS_TTL = 15.seconds

        def scoped_counts(connection, account_id, date_from, date_to, refresh)
          cache_key = "zoho_mail_scoped_stats_#{account_id}_#{date_from}_#{date_to}"
          Rails.cache.delete(cache_key) if refresh

          Rails.cache.fetch(cache_key, expires_in: SCOPED_STATS_TTL) do
            ::Mail::ScopedStats.call(
              zoho_client: zoho_client,
              access_token: connection.access_token,
              account_id: account_id,
              from: date_from.beginning_of_day,
              to: date_to.end_of_day
            )
          end
        end
      end
    end
  end
end

# Continuously picks up new mail for every active Zoho connection across
# all tenants — the "automatic new-mail scanning" piece, entirely
# independent of any user-selected date range. Whatever is picked in the
# Mail page's date filter (or in Recruitment's manual Scan Mail) changes
# nothing here: this job only ever moves forward from its own cursor,
# processing newly received mail.
#
# Each connection's own `last_synced_at` is the cursor: only messages
# received after it are considered on a given run, and it only advances
# once a run for that connection succeeds — so a failed run is retried
# from the same point next tick instead of silently skipping ahead, and
# the same message/attachment is never reprocessed (Recruitment::
# ZohoMailScanner's own source_attachment_id check is a second, redundant
# safety net on top of the cursor).
#
# Runs through ActiveJob like ZohoTokenRefreshJob, which this deliberately
# mirrors: a single recurring job spanning every company, wrapping each
# connection's own work in ActsAsTenant.with_tenant rather than relying on
# one ambient tenant for a platform-wide sweep.
class ZohoAutoScanJob < ApplicationJob
  queue_as :default

  # How far back to look the very first time a connection is auto-scanned
  # (no cursor yet). Deliberately small — this only needs to cover the gap
  # between "connection created" and "first cron tick", never to backfill
  # history.
  DEFAULT_LOOKBACK = 30.minutes

  # A single run can outlast the gap between ticks — importing a mail with
  # dozens of attachments takes minutes — and two runs overlapping would
  # scan the same window twice concurrently. Held in Redis rather than
  # Rails.cache because the cache store is per-process (:memory_store in
  # development), which would not exclude a second Sidekiq process. The TTL
  # is a deadlock guard: if a worker dies mid-scan the lock still frees.
  LOCK_TTL = 30.minutes

  def perform
    ActsAsTenant.without_tenant do
      ZohoConnection.active.find_each { |connection| with_lock(connection) { scan_one(connection) } }
    end
  end

  private

  def with_lock(connection)
    key = "zoho_auto_scan_lock/#{connection.id}"
    acquired = Sidekiq.redis { |r| r.set(key, Time.current.to_i, nx: true, ex: LOCK_TTL.to_i) }
    unless acquired
      Rails.logger.info("[ZohoAutoScanJob] connection #{connection.id} already scanning — skipping this tick")
      return
    end

    begin
      yield
    ensure
      Sidekiq.redis { |r| r.del(key) }
    end
  end

  def scan_one(connection)
    ActsAsTenant.with_tenant(connection.company) do
      run_started_at = Time.current
      cursor = connection.last_synced_at || connection.created_at || (run_started_at - DEFAULT_LOOKBACK)

      account_id = Rails.cache.fetch("zoho_account_id/#{connection.id}", expires_in: 1.hour) do
        Zoho::Client.new.fetch_account_id(access_token: connection.access_token)
      end

      Recruitment::ZohoMailScanner.call(
        company: connection.company,
        connection: connection,
        account_id: account_id,
        from: cursor,
        to: run_started_at
      )

      # Advance to when this run STARTED, not to "now" once it finishes and
      # not to the newest message's own timestamp — anything received while
      # the scan was running is still covered by the very next tick instead
      # of being silently skipped.
      connection.update!(last_synced_at: run_started_at)
    end
  rescue Zoho::TokenExpiredError
    ActsAsTenant.with_tenant(connection.company) { connection.update(status: :error) }
  rescue => e
    Rails.logger.warn("[ZohoAutoScanJob] connection #{connection.id} failed: #{e.class}: #{e.message}")
    # Cursor deliberately NOT advanced on failure — the next tick retries
    # this exact same window rather than moving on and losing mail.
  end
end

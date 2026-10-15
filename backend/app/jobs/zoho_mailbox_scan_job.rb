# Scans ONE connected Zoho mailbox for resume attachments.
#
# One job per mailbox (rather than one job walking every mailbox in turn) is
# what lets several connected accounts be scanned at the same time: Sidekiq
# runs these concurrently, so a mailbox with a slow, attachment-heavy window
# no longer holds up every other mailbox behind it. Two callers enqueue it:
#   - ZohoAutoScanJob, every tick, once per active mailbox, with no range —
#     "automatic" mode: scan new mail since this mailbox's own cursor
#     (`last_synced_at`) and advance the cursor on success.
#   - the manual Scan Mail action, once per mailbox the user ticked, with an
#     explicit `from`/`to` — never touches the cursor, and reports its
#     outcome into the Recruitment::MailScanRun named by `scan_id`.
#
# Runs through ActiveJob and resolves its tenant from the connection itself
# (wrapping the work in ActsAsTenant.with_tenant), like the other Zoho jobs.
class ZohoMailboxScanJob < ApplicationJob
  queue_as :default

  # How far back to look the very first time a mailbox is auto-scanned (no
  # cursor yet). Deliberately small — this only needs to cover the gap
  # between "connection created" and "first cron tick", never to backfill
  # history.
  DEFAULT_LOOKBACK = 30.minutes

  # A single run can outlast the gap between ticks — importing a mail with
  # dozens of attachments takes minutes — and two scans of the same mailbox
  # overlapping would walk the same messages twice concurrently, both
  # passing the "already imported?" check before either had saved. Held in
  # Redis rather than Rails.cache because the cache store is per-process
  # (:memory_store in development), which would not exclude a second Sidekiq
  # process. The TTL is a deadlock guard: if a worker dies mid-scan the lock
  # still frees. Manual and automatic scans share it.
  LOCK_TTL = 30.minutes

  class MailboxBusyError < StandardError; end

  # An automatic tick that finds its mailbox busy just skips it — the next
  # tick comes along in two minutes. A manual scan was asked for explicitly,
  # so it waits its turn instead (up to ~10 minutes) rather than silently
  # doing nothing.
  retry_on MailboxBusyError, wait: 20.seconds, attempts: 30 do |job, _error|
    job.send(:report, status: "failed", error: "This mailbox was busy with another scan for too long. Try again shortly.")
  end

  def perform(connection_id, from: nil, to: nil, scan_id: nil)
    @connection_id = connection_id
    @scan_id = scan_id

    connection = ActsAsTenant.without_tenant { ZohoConnection.find_by(id: connection_id) }
    # Disconnected (or broken) between being queued and running.
    unless connection&.active?
      report(status: "failed", error: "This mail account needs to be reconnected.")
      return
    end

    ActsAsTenant.with_tenant(connection.company) do
      if from && to
        scan_range(connection, from, to)
      else
        scan_new_mail(connection)
      end
    end
  end

  private

  def manual? = @scan_id.present?

  def report(**attrs)
    Recruitment::MailScanRun.update(@scan_id, @connection_id, **attrs)
  end

  def scan_new_mail(connection)
    with_lock(connection) do
      run_started_at = Time.current
      cursor = connection.last_synced_at || connection.created_at || (run_started_at - DEFAULT_LOOKBACK)

      scan(connection, from: cursor, to: run_started_at)

      # Advance to when this run STARTED, not to "now" once it finishes and
      # not to the newest message's own timestamp — anything received while
      # the scan was running is still covered by the very next tick instead
      # of being silently skipped.
      connection.update!(last_synced_at: run_started_at)
    end
  rescue => e
    handle_failure(connection, e)
    # Cursor deliberately NOT advanced on failure — the next tick retries
    # this exact same window rather than moving on and losing mail.
  end

  def scan_range(connection, from, to)
    acquired = with_lock(connection) do
      report(status: "running")
      result = scan(connection, from: from, to: to)
      report(
        status: "completed",
        scanned_messages: result.scanned_messages,
        detected_resumes: result.detected_resumes,
        skipped_duplicate_attachments: result.skipped_duplicate_attachments,
        skipped_non_resume_attachments: result.skipped_non_resume_attachments
      )
    end

    return if acquired

    report(status: "waiting")
    raise MailboxBusyError
  rescue MailboxBusyError
    raise
  rescue => e
    handle_failure(connection, e)
  end

  def scan(connection, from:, to:)
    # Refreshes a nearly-expired token first, and resolves Zoho's accountId
    # through the same cache the Mail controllers use.
    mailbox = Zoho::Mailbox.new(connection)
    mailbox.access_token

    Recruitment::ZohoMailScanner.call(
      company: connection.company,
      connection: connection,
      account_id: mailbox.account_id,
      from: from,
      to: to
    )
  end

  # Not re-raised: a failed automatic scan is retried by the next tick from
  # the same cursor, and a failed manual scan is reported back to the user —
  # a Sidekiq retry on top of either would only scan the window again.
  def handle_failure(connection, error)
    if error.is_a?(Zoho::TokenExpiredError)
      connection.update(status: :error)
      report(status: "failed", error: "Zoho rejected this mailbox's sign-in — reconnect it in Settings.")
    else
      Rails.logger.warn("[ZohoMailboxScanJob] connection #{connection.id} failed: #{error.class}: #{error.message}")
      report(status: "failed", error: error.message)
    end
  end

  # Yields only if this mailbox isn't already being scanned; returns whether
  # it did.
  def with_lock(connection)
    key = "zoho_mailbox_scan_lock/#{connection.id}"
    acquired = Sidekiq.redis { |r| r.set(key, Time.current.to_i, nx: true, ex: LOCK_TTL.to_i) }
    unless acquired
      Rails.logger.info("[ZohoMailboxScanJob] connection #{connection.id} already scanning — #{manual? ? 'waiting' : 'skipping this tick'}")
      return false
    end

    begin
      yield
    ensure
      Sidekiq.redis { |r| r.del(key) }
    end
    true
  end
end

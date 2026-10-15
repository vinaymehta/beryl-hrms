# Continuously picks up new mail for every active Zoho connection across
# all tenants — the "automatic new-mail scanning" piece, entirely
# independent of any user-selected date range. Whatever is picked in the
# Mail page's date filter (or in Recruitment's manual Scan Mail) changes
# nothing here: this only ever moves each mailbox forward from its own
# cursor, processing newly received mail.
#
# This job itself scans nothing: each tick fans out one ZohoMailboxScanJob
# per active mailbox, so every connected account is scanned in parallel
# rather than one after another. The cursor, the per-mailbox lock (which
# makes overlapping ticks safe) and the failure handling all live there.
#
# Runs through ActiveJob like ZohoTokenRefreshJob, which this deliberately
# mirrors: a single recurring job spanning every company — each fanned-out
# job then resolves its own tenant from its connection, rather than relying
# on one ambient tenant for a platform-wide sweep.
class ZohoAutoScanJob < ApplicationJob
  queue_as :default

  # The sidekiq-cron entry in config/sidekiq_cron_schedule.yml.
  CRON_NAME = "zoho_auto_scan".freeze

  # Runs only while there is something to scan: the 2-minute schedule is
  # switched ON while at least one Zoho mailbox is connected (active) and OFF
  # when none is — so with Zoho disconnected the job doesn't run at all. The
  # token refresh (ZohoTokenRefreshJob) has nothing to do either without a
  # mailbox, so its schedule is switched with this one.
  # Called whenever a connection is added, removed or changes status
  # (ZohoConnection callback) and when Sidekiq boots (config/initializers/sidekiq.rb).
  def self.sync_schedule!
    connected = ActsAsTenant.without_tenant { ZohoConnection.active.exists? }

    [ CRON_NAME, ZohoTokenRefreshJob::CRON_NAME ].each do |name|
      job = Sidekiq::Cron::Job.find(name)
      next if job.nil?

      if connected
        job.enable! unless job.enabled?
      elsif job.enabled?
        job.disable!
      end
    end
  rescue StandardError => e
    # Scheduling is housekeeping; it must never break connecting a mailbox.
    Rails.logger.warn("[ZohoAutoScanJob] couldn't sync the schedule: #{e.class}: #{e.message}")
  end

  def perform
    ActsAsTenant.without_tenant do
      # Empty when the last mailbox was disconnected after this tick was
      # already queued — then there's simply nothing to enqueue.
      jobs = ZohoConnection.active.ids.map { |id| ZohoMailboxScanJob.new(id) }
      ActiveJob.perform_all_later(jobs)
    end
  end
end

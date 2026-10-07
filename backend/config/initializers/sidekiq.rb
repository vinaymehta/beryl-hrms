Sidekiq.configure_server do |config|
  config.redis = { url: ENV.fetch("REDIS_URL") }

  config.on(:startup) do
    schedule_file = Rails.root.join("config/sidekiq_cron_schedule.yml")
    Sidekiq::Cron::Job.load_from_hash(YAML.load_file(schedule_file)) if File.exist?(schedule_file)
    # Loading the file (re)enables every entry; switch Zoho auto-scan back off
    # if no mailbox is connected.
    ZohoAutoScanJob.sync_schedule!
  end
end

Sidekiq.configure_client do |config|
  config.redis = { url: ENV.fetch("REDIS_URL") }
end

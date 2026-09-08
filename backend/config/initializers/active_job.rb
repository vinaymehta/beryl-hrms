# Set on the ActiveJob::Base class_attribute directly (not via
# config.active_job.*, which activejob's own railtie deliberately excludes
# this setting from — see active_job/railtie.rb) so every subclass inherits
# it by default, including ActionMailer::MailDeliveryJob, which extends
# ActiveJob::Base directly rather than through this app's ApplicationJob.
#
# Effect: a job enqueued from inside a DB transaction that later rolls back
# (e.g. registration failing after `deliver_later`) is never sent to
# Sidekiq/Redis at all — Rails waits until the transaction actually commits.
Rails.application.config.to_prepare do
  ActiveJob::Base.enqueue_after_transaction_commit = true
end

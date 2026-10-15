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

# A mail whose record was deleted before it went out (a notification removed
# with its appraisal or cycle, say) can never be sent: every retry fails the
# same way while loading its arguments, for about three weeks. Such a mail is
# dropped instead of retried. Set on MailDeliveryJob directly because it
# extends ActiveJob::Base, not ApplicationJob.
ActiveSupport.on_load(:action_mailer) do
  ActionMailer::MailDeliveryJob.discard_on ActiveJob::DeserializationError
end

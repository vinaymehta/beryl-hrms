module Appraisals
  # Everything that must stop happening when a cycle is deleted.
  #
  # Called BEFORE the cycle is destroyed, because it needs the appraisals to
  # find the notifications that point at them — once `dependent: :destroy` has
  # run, those notifications are orphans with a `notifiable_id` pointing at a
  # row that no longer exists, and nothing left to find them by.
  #
  # On "scheduled jobs": there are none to cancel, and that is by design rather
  # than an omission. AppraisalRemindersJob is a single daily sweep that reads
  # `AppraisalCycle.where(status: :active)` — it holds no per-cycle state and
  # enqueues nothing in advance, so a deleted cycle is simply never visited
  # again. Had reminders been scheduled per cycle, this is where they would be
  # cancelled; the method is left named for that so the next person looking for
  # it finds the answer here instead of concluding it was forgotten.
  class CancelCycleNotifications
    Result = Struct.new(:notifications_removed, keyword_init: true)

    def self.call(...) = new(...).call

    def initialize(cycle:)
      @cycle = cycle
    end

    def call
      removed = purge_notifications
      Rails.logger.info(
        "[appraisal] cycle ##{@cycle.id} deleted — removed #{removed} notification(s) that pointed at it"
      )
      Result.new(notifications_removed: removed)
    end

    private
      # Both the appraisals' notifications and any raised against the cycle
      # itself. delete_all rather than destroy_all: these carry no callbacks,
      # and a cohort of several hundred should not be a several-hundred-query
      # operation inside a delete request.
      def purge_notifications
        appraisal_ids = @cycle.appraisals.pluck(:id)

        scope = Notification.where(notifiable_type: "AppraisalCycle", notifiable_id: @cycle.id)
        scope = scope.or(
          Notification.where(notifiable_type: "Appraisal", notifiable_id: appraisal_ids)
        ) if appraisal_ids.any?

        scope.delete_all
      end
  end
end

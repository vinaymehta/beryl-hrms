# The scope's due-date and overdue reminders (§24). Everything else in the
# workflow notifies at the moment somebody acts; these two are the only ones
# that depend on the calendar rather than on an action, so they need a tick.
#
# Runs daily. Deliberately idempotent-per-day: a notification is only created
# when the same category hasn't already been sent for that appraisal today, so a
# retry or an extra tick can't spam anyone.
class AppraisalRemindersJob < ApplicationJob
  queue_as :default

  # How many days before a deadline the "due soon" nudge goes out.
  REMINDER_WINDOW_DAYS = 3

  def perform
    # Runs across every tenant, so each company's work is wrapped in its own
    # tenant block rather than relying on an ambient one.
    Company.find_each do |company|
      ActsAsTenant.with_tenant(company) { process_company }
    end
  end

  private
    def process_company
      AppraisalCycle.where(status: :active).find_each do |cycle|
        remind_employees(cycle)
        remind_reviewers(cycle)
      end
    end

    # Self-appraisals still outstanding: a nudge inside the window, an overdue
    # notice once the deadline has passed.
    def remind_employees(cycle)
      deadline = cycle.employee_submission_deadline
      return if deadline.blank?

      scope = cycle.appraisals.where(status: :self_appraisal_open)

      if Date.current > deadline
        scope.find_each { |appraisal| notify_once(appraisal, "appraisal.overdue") { Appraisals::Notifier.overdue(appraisal, role: :employee) } }
      elsif (deadline - Date.current).to_i <= REMINDER_WINDOW_DAYS
        scope.find_each { |appraisal| notify_once(appraisal, "appraisal.submission_due") { Appraisals::Notifier.submission_due(appraisal) } }
      end
    end

    # Each review stage against its own deadline — an overdue primary review is
    # the primary manager's problem, not the final manager's.
    def remind_reviewers(cycle)
      {
        primary: [ :primary_review, cycle.primary_review_deadline ],
        secondary: [ :secondary_review, cycle.secondary_review_deadline ],
        final: [ :final_review, cycle.finalization_deadline ]
      }.each do |role, (status, deadline)|
        next if deadline.blank?
        next unless Date.current > deadline

        cycle.appraisals.where(status: status).find_each do |appraisal|
          notify_once(appraisal, "appraisal.overdue") { Appraisals::Notifier.overdue(appraisal, role: role) }
        end
      end
    end

    # One notification of a given kind per appraisal per day, whatever happens
    # to the schedule.
    def notify_once(appraisal, category)
      already_sent = Notification.where(
        notifiable_type: "Appraisal", notifiable_id: appraisal.id, category: category
      ).where(created_at: Time.current.all_day).exists?
      return if already_sent

      yield
    end
end

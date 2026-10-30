# Chases interviewer feedback so nobody has to remember to. Each tick:
#   * requests feedback once an interview is an hour behind us and no request
#     has gone out (manual or automatic — the manual button stamps
#     feedback_requested_at too, so the two never double-send);
#   * sends one reminder a day after the request if it is still unanswered.
#
# Both only look back LOOKBACK, so the first run after deploy doesn't mail
# every interviewer about interviews from months ago.
class InterviewFeedbackRequestsJob < ApplicationJob
  queue_as :default

  REQUEST_AFTER = 1.hour
  REMIND_AFTER = 24.hours
  LOOKBACK = 7.days

  def perform
    # Runs across every tenant, so each company's work is wrapped in its own
    # tenant block rather than relying on an ambient one.
    Company.find_each do |company|
      ActsAsTenant.with_tenant(company) do
        request_due
        remind_due
      end
    end
  end

  private
    def unanswered
      Candidate.where(feedback_submitted_at: nil).where.not(interviewer_id: nil).includes(:interviewer)
    end

    def request_due
      unanswered.where(status: %w[interview_scheduled interview_completed], feedback_requested_at: nil)
                .where(interview_at: LOOKBACK.ago..REQUEST_AFTER.ago)
                .find_each do |candidate|
        deliver(candidate) do
          candidate.ensure_feedback_token!
          # Same move as the manual Request feedback button.
          candidate.update!(feedback_requested_at: Time.current, status: :feedback_not_received)
        end
      end
    end

    def remind_due
      unanswered.where(status: Candidate::FEEDBACK_AWAITING_STATUSES, feedback_reminder_sent_at: nil)
                .where(feedback_requested_at: LOOKBACK.ago..REMIND_AFTER.ago)
                .find_each do |candidate|
        deliver(candidate, reminder: true) { candidate.update!(feedback_reminder_sent_at: Time.current) }
      end
    end

    # Stamped before the mail is queued, so a retry or overlapping tick can't
    # send it twice. One bad row is logged and skipped, not fatal to the rest.
    def deliver(candidate, reminder: false)
      # Nobody to send to: left unstamped, so it goes out once an address is
      # added rather than being silently marked as sent.
      return if candidate.interviewer.work_email.blank?

      yield
      InterviewerMailer.feedback_request(candidate, reminder: reminder).deliver_later
    rescue => e
      Rails.logger.error("[InterviewFeedbackRequestsJob] candidate #{candidate.id}: #{e.class}: #{e.message}")
    end
end

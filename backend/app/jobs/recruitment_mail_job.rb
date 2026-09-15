# Delivers a recruitment email through the company's connected Zoho mailbox,
# off the request thread.
#
# Takes the mailer class/action/candidate rather than a serialized Mail object:
# the message is rendered here, so a template change never has to be
# compatible with jobs already sitting in the queue.
class RecruitmentMailJob < ApplicationJob
  queue_as :default

  RETRYABLE = [ Zoho::RateLimitedError, Faraday::TimeoutError, Faraday::ConnectionFailed, Net::OpenTimeout ].freeze
  retry_on(*RETRYABLE, wait: :polynomially_longer, attempts: 3)

  def perform(mailer_name, action, candidate_id)
    candidate = Candidate.unscoped.find_by(id: candidate_id)
    return unless candidate

    ActsAsTenant.with_tenant(candidate.company) do
      mail = mailer_name.constantize.public_send(action, candidate)

      begin
        result = Recruitment::ZohoMailSender.call(mail: mail, company: candidate.company)
        # A blank recipient (e.g. an interviewer with no email on file) is
        # refused by the sender rather than misrouted — say so, or it looks
        # exactly like a successful send.
        unless result.success?
          Rails.logger.error("[RecruitmentMail] #{mailer_name}##{action} not sent for candidate #{candidate.id}: #{result.error}")
        end
      rescue Recruitment::ZohoMailSender::NoMailboxError => e
        # Not retryable — no amount of waiting connects a mailbox. Logged
        # loudly rather than retried into the dead set.
        Rails.logger.error("[RecruitmentMail] #{mailer_name}##{action} for candidate #{candidate.id}: #{e.message}")
      rescue Zoho::TokenExpiredError => e
        Rails.logger.error("[RecruitmentMail] #{mailer_name}##{action} for candidate #{candidate.id}: mailbox needs reconnecting (#{e.message})")
      end
    end
  end
end

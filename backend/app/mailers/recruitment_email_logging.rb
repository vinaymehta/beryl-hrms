# Logs every mail a recruitment mailer actually delivers as a RecruitmentEmail,
# so the resume panel's Emails tab can show it next to the Zoho conversation —
# mail sent through ActionMailer never lands in any connected Zoho mailbox.
#
# Included by CandidateMailer and InterviewerMailer. The candidate is read from
# the @candidate both of them set, so no mailer action needs to change to be
# logged. An action that may run before there is a candidate (an application
# just received) sets @candidate_resume as well: the mail is then logged
# against that resume, and ResumeExtractionJob fills the candidate in later.
#
# after_deliver runs only once delivery has returned without raising, so a
# failed send is never logged as sent. It does still run for an action that
# returned early without calling `mail` (see missing_recipient?) — that leaves
# a NullMail with no recipients behind, which is skipped below.
module RecruitmentEmailLogging
  extend ActiveSupport::Concern

  included do
    after_deliver :log_recruitment_email
  end

  private
    def log_recruitment_email
      return if message.is_a?(ActionMailer::Base::NullMail) || Array(message.to).empty?
      # perform_deliveries off means nothing actually left the app.
      return unless message.perform_deliveries

      candidate = @candidate if @candidate.is_a?(Candidate)
      resume = @candidate_resume if @candidate_resume.is_a?(CandidateResume)
      return unless candidate || resume

      company = candidate&.company || resume.company
      # Inside the delivery job the tenant is normally restored already; set
      # explicitly so logging never depends on that.
      ActsAsTenant.with_tenant(company) do
        RecruitmentEmail.create!(
          company_id: company.id,
          candidate: candidate || resume.candidate,
          candidate_resume: resume || candidate.candidate_resumes.order(is_current: :desc, created_at: :desc).first,
          mailer: self.class.name,
          mailer_action: action_name,
          to_address: message[:to].to_s,
          from_address: message[:from].to_s,
          subject: message.subject,
          body_text: plain_text_body,
          # Names only — the brand logo is an inline part, not an attachment.
          attachment_names: message.attachments.reject(&:inline?).map(&:filename),
          message_id: message.message_id,
          sent_at: Time.current
        )
      end
    rescue StandardError => e
      # The mail has already gone out — a logging failure must not make the
      # job retry and send it a second time.
      Rails.logger.error("[RecruitmentEmailLogging] could not log #{self.class.name}##{action_name}: #{e.class}: #{e.message}")
    end

    # The text/plain part every recruitment template ships alongside its HTML;
    # text_part searches nested parts, which the inline logo introduces.
    def plain_text_body
      part = message.multipart? ? message.text_part : (message.mime_type == "text/plain" ? message : nil)
      part&.decoded.to_s.strip
    end
end

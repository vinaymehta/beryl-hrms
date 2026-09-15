# Mail sent to the INTERVIEWER — an employee, i.e. an internal recipient.
# Distinct from CandidateMailer precisely because the audiences differ: this
# one may carry internal detail and the candidate's resume, none of which
# belongs in anything CandidateMailer sends.
class InterviewerMailer < ApplicationMailer
  # Fired automatically once Calendly confirms a booking. Carries everything the
  # interviewer needs to prepare without opening the app: who, when, how to
  # reach them, and the resume itself.
  def interview_booked(candidate)
    @candidate = candidate
    @interviewer = candidate.interviewer
    @interview_at = candidate.interview_at
    @when_text = formatted_when
    @join_url = candidate.calendly_join_url
    # The feedback form link travels WITH the booking, so the interviewer can
    # write up the candidate straight after the interview without waiting for
    # anyone to send them anything. Nobody has to remember to chase them.
    @feedback_url = "#{frontend_base_url}/feedback/#{candidate.ensure_feedback_token!}"

    attach_resume(candidate)

    mail(
      to: interviewer_email(@interviewer),
      subject: "Interview booked: #{candidate.name} — #{formatted_when}"
    )
  end

  # Asks the INTERVIEWER to assess the candidate they interviewed. Sent only
  # when an admin chooses to — nothing requests feedback automatically.
  #
  # The form itself needs no login (per spec): the unguessable token in this
  # link is what authenticates it, which is why the link is a credential and
  # must not be forwarded.
  def feedback_request(candidate)
    @candidate = candidate
    @interviewer = candidate.interviewer
    @interview_at = candidate.interview_at
    @when_text = formatted_when
    @feedback_url = "#{frontend_base_url}/feedback/#{candidate.ensure_feedback_token!}"

    mail(
      to: interviewer_email(@interviewer),
      subject: "Your feedback on #{candidate.name}"
    )
  end

  private

    # The interviewer's OWN address, and nothing else.
    #
    # This deliberately does NOT fall back to interviewer.user.email_address.
    # A login is an authentication identity, frequently a shared role account
    # (admin@, hr@, accounts@) — falling back to it sent candidate details and
    # CVs to whoever owned that account rather than to the interviewer. Blank
    # is returned when there is no address, so nothing is sent at all; that is
    # strictly better than delivering an interview packet to the wrong inbox.
    def interviewer_email(interviewer)
      interviewer&.personal_email.presence
    end

    # The candidate's current resume, attached as the real file. Skipped rather
    # than raising if there's nothing stored — the interviewer still needs the
    # time and contact details even when the file is missing.
    def attach_resume(candidate)
      resume = candidate.candidate_resumes.order(is_current: :desc, created_at: :desc).first
      return unless resume&.file&.attached?

      attachments[resume.file_name.presence || "resume.pdf"] = resume.file.download
      @resume_attached = true
    rescue => e
      Rails.logger.warn("[InterviewerMailer] could not attach resume for candidate #{candidate.id}: #{e.class}: #{e.message}")
      @resume_attached = false
    end

    # Interviews are booked and read in IST regardless of server zone.
    def formatted_when
      return "time to be confirmed" if @interview_at.blank?

      @interview_at.in_time_zone("Asia/Kolkata").strftime("%d %b %Y, %I:%M %p IST")
    end
end

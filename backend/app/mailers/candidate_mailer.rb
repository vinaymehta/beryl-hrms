# Mail sent TO the candidate (an outside recipient), as opposed to
# UserMailer which writes to staff accounts. Keep that distinction in mind
# when adding to this class: nothing internal — interviewer names, notes,
# scores, other candidates — belongs in anything sent from here.
class CandidateMailer < ApplicationMailer
  # Used for both the first schedule and every reschedule: the candidate
  # only ever needs the current date and time, so a resend is the same mail
  # with updated details rather than a separate "changed" template.
  #
  # Deliberately says nothing about WHO is interviewing them — that is
  # internal information, and naming the interviewer here would leak an
  # employee's identity to an outside recipient.
  def interview_invitation(candidate)
    @candidate = candidate
    @interview_at = candidate.interview_at

    mail(to: candidate.email, subject: "Your interview is scheduled")
  end

  def feedback_request(candidate)
    @candidate = candidate
    @feedback_url = feedback_form_url(candidate)

    mail(to: candidate.email, subject: "We'd love your feedback on your interview")
  end

  private

  # The in-app form, addressed by the candidate's own unguessable token — that
  # token is the only thing authenticating them on a public endpoint, so this
  # link is a credential and must not be forwarded or logged.
  def feedback_form_url(candidate)
    "#{frontend_base_url}/feedback/#{candidate.ensure_feedback_token!}"
  end

  def frontend_base_url
    ENV.fetch("FRONTEND_ORIGINS", "http://localhost:3000").split(",").first.strip
  end
end

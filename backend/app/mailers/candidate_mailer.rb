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

  # Sent when an admin starts the interview flow. The candidate picks their own
  # slot in Calendly, so this carries a link rather than a date — and, like the
  # invitation above, says nothing about WHO will interview them.
  def interview_booking_link(candidate)
    @candidate = candidate
    @booking_url = candidate.calendly_scheduling_url

    mail(to: candidate.email, subject: "Book your interview slot")
  end
end

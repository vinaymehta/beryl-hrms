# Mail sent TO the candidate (an outside recipient), as opposed to
# UserMailer which writes to staff accounts. Keep that distinction in mind
# when adding to this class: nothing internal — interviewer names, notes,
# scores, other candidates — belongs in anything sent from here.
class CandidateMailer < ApplicationMailer
  # Every delivered mail is logged for the candidate's Emails timeline.
  include RecruitmentEmailLogging

  # Sent when an admin starts the interview flow. The candidate picks their own
  # slot in Calendly, so this carries a link rather than a date. Deliberately
  # says nothing about WHO will interview them — that is internal information,
  # and naming the interviewer would leak an employee's identity to an outside
  # recipient. (Calendly sends the candidate its own confirmation once booked.)
  def interview_booking_link(candidate)
    return if missing_recipient?(candidate.email, "candidate #{candidate.id}")

    @candidate = candidate
    @booking_url = candidate.calendly_scheduling_url

    mail(to: candidate.email, subject: "Book your interview slot")
  end
end

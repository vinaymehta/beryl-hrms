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

  # Sent as soon as the careers website hands over an application, to the
  # address typed on the form — before the resume is read, so usually before
  # there is a candidate: RecruitmentEmailLogging then logs it against the
  # resume, and ResumeExtractionJob links it to the candidate once found.
  def application_received(application)
    @application = application
    @candidate = application.candidate
    @candidate_resume = application.candidate_resume
    @job_title = application.job_opening&.title

    subject = @job_title ? "We've received your application for #{@job_title}" : "We've received your application"
    mail(to: application.email, subject: subject)
  end
end

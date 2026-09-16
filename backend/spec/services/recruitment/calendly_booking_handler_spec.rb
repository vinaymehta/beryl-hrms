require "rails_helper"

RSpec.describe Recruitment::CalendlyBookingHandler do
  let(:company) { create(:company) }
  let(:interviewer) do
    ActsAsTenant.with_tenant(company) { create(:employee, company: company, personal_email: "lead@acme.test") }
  end

  # A candidate who has been sent a booking link and has not booked yet: the
  # correlation token is planted, nothing about a booking is recorded.
  def awaiting_booking_candidate
    ActsAsTenant.with_tenant(company) do
      create(
        :candidate,
        company: company,
        status: :shortlisted,
        interviewer: interviewer,
        calendly_booking_token: "tok-123",
        interview_link_sent_at: 1.hour.ago
      )
    end
  end

  def created_payload(invitee_uri: "https://api.calendly.com/scheduled_events/E1/invitees/I1", token: "tok-123")
    {
      "payload" => {
        "uri" => invitee_uri,
        "event" => "https://api.calendly.com/scheduled_events/E1",
        "tracking" => { "utm_source" => token },
        "scheduled_event" => {
          "start_time" => 3.days.from_now.iso8601,
          "location" => { "join_url" => "https://meet.example/abc" }
        }
      }
    }
  end

  describe "invitee.created" do
    it "schedules the interview and notifies the interviewer once" do
      candidate = awaiting_booking_candidate

      expect {
        described_class.call(event: "invitee.created", payload: created_payload)
      }.to have_enqueued_job(RecruitmentMailJob).with("InterviewerMailer", "interview_booked", candidate.id)

      candidate.reload
      expect(candidate.status).to eq("interview_scheduled")
      expect(candidate.interview_at).to be_present
      expect(candidate.calendly_join_url).to eq("https://meet.example/abc")
    end

    # Calendly retries a webhook it doesn't get a clean response to, and once
    # the invitee URI is recorded the retry matches this candidate by it — so
    # without a per-booking marker the interviewer gets the whole packet,
    # resume attachment included, a second time.
    it "does not notify the interviewer again when the same booking is replayed" do
      awaiting_booking_candidate
      described_class.call(event: "invitee.created", payload: created_payload)

      expect {
        described_class.call(event: "invitee.created", payload: created_payload)
      }.not_to have_enqueued_job(RecruitmentMailJob).with("InterviewerMailer", "interview_booked", anything)
    end

    # A reschedule is a different booking and Calendly gives it a new invitee
    # URI, so the interviewer does need to hear about it.
    it "notifies again for a genuinely different booking" do
      candidate = awaiting_booking_candidate
      described_class.call(event: "invitee.created", payload: created_payload)

      expect {
        described_class.call(
          event: "invitee.created",
          payload: created_payload(invitee_uri: "https://api.calendly.com/scheduled_events/E2/invitees/I2")
        )
      }.to have_enqueued_job(RecruitmentMailJob).with("InterviewerMailer", "interview_booked", candidate.id)
    end
  end

  describe "invitee.canceled" do
    it "rejects a candidate whose booked interview is cancelled" do
      candidate = awaiting_booking_candidate
      described_class.call(event: "invitee.created", payload: created_payload)

      described_class.call(event: "invitee.canceled", payload: created_payload)

      expect(candidate.reload.status).to eq("rejected")
      expect(candidate.interview_at).to be_nil
    end

    # A late or replayed cancellation must not undo a human's decision.
    it "ignores a cancellation for a candidate who is no longer merely scheduled" do
      candidate = awaiting_booking_candidate
      described_class.call(event: "invitee.created", payload: created_payload)
      ActsAsTenant.with_tenant(company) { candidate.reload.update!(status: :interview_completed) }

      described_class.call(event: "invitee.canceled", payload: created_payload)

      expect(candidate.reload.status).to eq("interview_completed")
    end
  end

  it "ignores a webhook it cannot tie to a candidate" do
    expect(described_class.call(event: "invitee.created", payload: created_payload(token: "unknown"))).to eq(:unmatched)
  end
end

module Recruitment
  # Applies an inbound Calendly webhook to the candidate it belongs to.
  #
  # This is the ONLY thing that sets `Interview Scheduled`: per spec, a booking
  # is scheduled when Calendly says it is, never when an admin asserts it.
  # Likewise a cancellation moves the candidate to `Rejected` automatically.
  #
  # Runs untenanted at the lookup step (a webhook carries no session), then
  # scopes every write to the candidate's own company.
  class CalendlyBookingHandler
    CREATED = "invitee.created".freeze
    CANCELED = "invitee.canceled".freeze
    HANDLED_EVENTS = [ CREATED, CANCELED ].freeze

    def self.call(...) = new(...).call

    def initialize(event:, payload:)
      @event = event.to_s
      @payload = payload || {}
    end

    def call
      return :ignored unless HANDLED_EVENTS.include?(@event)

      candidate = find_candidate
      return :unmatched if candidate.nil?

      ActsAsTenant.with_tenant(candidate.company) do
        @event == CREATED ? handle_booked(candidate) : handle_canceled(candidate)
      end
    end

    private

      # Two ways in, in order of reliability:
      #  1. the invitee URI, once we've already recorded it (cancellations);
      #  2. the correlation token we planted in the booking URL as utm_source,
      #     which Calendly echoes back under `tracking` (first booking).
      #
      # Calendly does NOT tell us which scheduling link was used — there is no
      # such field on the payload — so the token is the only reliable link back.
      # Email is deliberately not used: the invitee types it themselves, so it
      # frequently differs from the address on file, and two candidates can
      # share one. Acting on the wrong person's interview is worse than
      # ignoring an unmatched hook.
      def find_candidate
        ActsAsTenant.without_tenant do
          if invitee_uri.present?
            by_invitee = Candidate.find_by(calendly_invitee_uri: invitee_uri)
            return by_invitee if by_invitee
          end

          Candidate.find_by(calendly_booking_token: booking_token) if booking_token.present?
        end
      end

      def handle_booked(candidate)
        candidate.update!(
          calendly_invitee_uri: invitee_uri,
          calendly_event_uri: event_uri,
          calendly_join_url: join_url,
          interview_at: start_time,
          status: :interview_scheduled
        )

        notify_interviewer(candidate)
        :scheduled
      end

      def handle_canceled(candidate)
        # Only a booked interview can be cancelled. Guarding this stops a
        # replayed or late hook from rejecting someone who has since been moved
        # on by a human (marked completed, say).
        unless candidate.interview_scheduled?
          Rails.logger.info("[Calendly] ignoring cancellation for candidate #{candidate.id} in status #{candidate.status}")
          return :ignored
        end

        candidate.update!(status: :rejected, interview_at: nil)
        :canceled
      end

      # Once per BOOKING, not once per candidate.
      #
      # Calendly retries a webhook it doesn't get a clean response to, and once
      # calendly_invitee_uri is recorded, find_candidate matches a replayed
      # invitee.created by that URI too — so an unguarded send delivers the
      # whole packet, resume attachment included, again for a booking the
      # interviewer has already been told about. Recording which invitee the
      # notification went out for makes a replay a no-op while still notifying
      # for a genuinely different booking (a reschedule gets a new invitee URI).
      def notify_interviewer(candidate)
        return if candidate.interviewer.nil?
        return if candidate.interviewer_notified_invitee_uri.present? &&
                  candidate.interviewer_notified_invitee_uri == candidate.calendly_invitee_uri

        RecruitmentMailJob.perform_later("InterviewerMailer", "interview_booked", candidate.id)
        # Marked on enqueue rather than on delivery: the job has its own retry
        # policy, so re-sending here on a later webhook replay would duplicate
        # a mail that is still in flight rather than rescue a lost one.
        candidate.update_column(:interviewer_notified_invitee_uri, candidate.calendly_invitee_uri)
      rescue => e
        # A booking that is already confirmed in Calendly must not be rolled
        # back because we failed to send an internal notification.
        Rails.logger.error("[InterviewerMailer] notify failed for candidate #{candidate.id}: #{e.class}: #{e.message}")
      end

      def payload_resource
        @payload["payload"] || @payload
      end

      def invitee_uri
        payload_resource["uri"].presence
      end

      def booking_token
        payload_resource.dig("tracking", "utm_source").presence
      end

      def event_uri
        payload_resource["event"].presence
      end

      # Conferencing link for the booking. Absent for in-person or phone event
      # types, and Calendly may still be provisioning it at webhook time
      # (location.status == "processing"), so nil is a normal outcome.
      def join_url
        payload_resource.dig("scheduled_event", "location", "join_url").presence
      end

      # Calendly sends UTC ISO-8601; the app displays Asia/Kolkata, which
      # Time.zone handles on the way out. Store the instant, not a local string.
      def start_time
        raw = payload_resource.dig("scheduled_event", "start_time").presence
        return nil if raw.blank?

        Time.zone.parse(raw)
      rescue ArgumentError
        nil
      end
  end
end

module Recruitment
  # Moves a Shortlisted candidate into the interview flow: assigns the
  # interviewer and sends the candidate a single-use Calendly booking link.
  #
  # Deliberately does NOT set a status. The candidate stays `Shortlisted` until
  # Calendly confirms an actual booking (see CalendlyBookingHandler) — the
  # spec's rule that only a confirmed booking produces `Interview Scheduled`.
  # `interview_link_sent_at` is what the UI reads to show "Booking link sent".
  class InterviewScheduler
    Result = Struct.new(:success?, :candidate, :error, keyword_init: true)

    def self.call(...) = new(...).call

    def initialize(candidate:, interviewer:, client: Calendly::Client.new)
      @candidate = candidate
      @interviewer = interviewer
      @client = client
    end

    def call
      return failure("Select an interviewer before sending a booking link.") if @interviewer.nil?
      return failure("#{@candidate.name} has no email address on file, so the booking link can't be sent.") if @candidate.email.blank?

      # Caught here rather than at send time: the interviewer notification is
      # only built once the candidate books, so a missing address would
      # otherwise surface as a silent failure hours later.
      if @interviewer.personal_email.blank?
        return failure("#{@interviewer.full_name} has no email address on file, so they can't be notified when the candidate books. Add one to their employee record first.")
      end

      if @candidate.company.zoho_connections.where(status: :active).none?
        return failure("Connect a company mailbox in Settings — the booking link is sent from it.")
      end

      connection = @candidate.company.calendly_connections.find_by(status: :active)
      return failure("Connect a Calendly account in Settings before scheduling interviews.") if connection.nil?
      return failure("Pick which Calendly event type interviews are booked against, in Settings.") if connection.default_event_type_uri.blank?

      link = create_link(connection)
      return failure("Calendly did not return a booking link. Try again.") if link.blank?

      # Calendly's webhook never reveals which scheduling link was used, so the
      # only way to tie a booking back to this candidate is a correlation ID we
      # put into the URL ourselves. UTM params are echoed back verbatim in the
      # webhook's `tracking` object, which is exactly what they're for here.
      token = SecureRandom.urlsafe_base64(16)

      @candidate.update!(
        interviewer: @interviewer,
        calendly_booking_token: token,
        calendly_scheduling_url: booking_url_with(link, token),
        interview_link_sent_at: Time.current,
        # A previous booking's identifiers must not survive into a new invite,
        # or a stale cancellation webhook could act on this candidate.
        calendly_invitee_uri: nil,
        calendly_event_uri: nil,
        calendly_join_url: nil,
        interview_at: nil,
        # Issuing a new link voids any previous booking, so the candidate is
        # back to awaiting one — which in this design IS Shortlisted (only a
        # confirmed Calendly booking sets Interview Scheduled). Without this,
        # clearing interview_at while the status still said interview_scheduled
        # tripped the model's own "interview_at is required" validation, and
        # resending a link to an already-booked candidate failed outright.
        status: :shortlisted
      )

      deliver_link
      Result.new(success?: true, candidate: @candidate)
    rescue Calendly::ApiError => e
      Rails.logger.error("[Calendly] scheduling link failed for candidate #{@candidate.id}: #{e.message}")
      failure("Couldn't reach Calendly to create the booking link. Try again shortly.")
    end

    private

      def create_link(connection)
        token = Calendly::AccessToken.for(connection)
        resource = @client.create_scheduling_link(
          access_token: token,
          event_type_uri: connection.default_event_type_uri
        )
        resource["booking_url"].presence
      end

      # Prefills who they are so the booking carries the right name/email, and
      # tags it so the webhook can find this candidate again.
      def booking_url_with(url, token)
        uri = URI.parse(url)
        params = URI.decode_www_form(uri.query.to_s)
        params << [ "utm_source", token ]
        params << [ "name", @candidate.name.to_s ] if @candidate.name.present?
        params << [ "email", @candidate.email.to_s ] if @candidate.email.present?
        # Puts the interviewer ON the Calendly event as a guest, so they get a
        # real calendar invite and the conferencing link from Calendly itself.
        # Without this the event's only host is the connected Calendly account
        # (the admin), and the person actually conducting the interview has no
        # calendar entry and no way in.
        params << [ "guests", @interviewer.personal_email.to_s ] if @interviewer.personal_email.present?
        uri.query = URI.encode_www_form(params)
        uri.to_s
      rescue URI::InvalidURIError
        url
      end

      # Sent FROM the company's connected Zoho mailbox, not SMTP — a candidate
      # should receive this from an address they recognise and can reply to.
      # Mail must never take down a scheduling action that already succeeded.
      def deliver_link
        RecruitmentMailJob.perform_later("CandidateMailer", "interview_booking_link", @candidate.id)
      rescue => e
        Rails.logger.error("[RecruitmentMail] booking link failed for candidate #{@candidate.id}: #{e.class}: #{e.message}")
      end

      def failure(message)
        Result.new(success?: false, candidate: @candidate, error: message)
      end
  end
end

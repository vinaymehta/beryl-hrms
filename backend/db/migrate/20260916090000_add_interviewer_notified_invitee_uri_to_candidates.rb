class AddInterviewerNotifiedInviteeUriToCandidates < ActiveRecord::Migration[8.1]
  def change
    # Which Calendly booking the interviewer has already been told about.
    #
    # Stores the invitee URI rather than a plain "notified" boolean or
    # timestamp, because the requirement is one notification PER BOOKING, not
    # one per candidate. Calendly retries a webhook it doesn't get a clean
    # response to, and after the first booking CalendlyBookingHandler can also
    # match a replayed invitee.created by this same invitee URI — so without a
    # marker the interviewer gets the whole packet, resume attachment and all,
    # again for a booking they were already told about. Comparing URIs means a
    # replay is silently skipped while a genuinely new booking (a reschedule,
    # which Calendly issues a new invitee URI for) still notifies.
    add_column :candidates, :interviewer_notified_invitee_uri, :string
  end
end

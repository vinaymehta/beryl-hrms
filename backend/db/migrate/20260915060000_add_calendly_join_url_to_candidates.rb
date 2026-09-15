class AddCalendlyJoinUrlToCandidates < ActiveRecord::Migration[8.1]
  def change
    # The conferencing link Calendly creates for the booking (Google Meet/Zoom
    # /etc). It arrives on the invitee.created webhook under
    # scheduled_event.location.join_url and was previously discarded, leaving
    # the interviewer with a time and a CV but no way to actually join.
    add_column :candidates, :calendly_join_url, :string
  end
end

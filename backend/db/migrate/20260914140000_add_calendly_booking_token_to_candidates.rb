class AddCalendlyBookingTokenToCandidates < ActiveRecord::Migration[8.1]
  def change
    # Correlation ID we mint and put into the booking URL as `utm_source`.
    # Calendly echoes UTM params back on the webhook (payload.tracking), which
    # is the ONLY reliable way to know which candidate a booking belongs to:
    # the webhook never says which scheduling link was used, and the invitee's
    # typed-in email frequently differs from the one on file.
    #
    # Random rather than the candidate id, so a candidate editing the URL
    # cannot mark a DIFFERENT candidate as scheduled — a tampered value simply
    # matches nothing.
    add_column :candidates, :calendly_booking_token, :string
    add_index :candidates, :calendly_booking_token, unique: true
  end
end

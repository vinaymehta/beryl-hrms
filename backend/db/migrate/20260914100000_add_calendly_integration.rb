class AddCalendlyIntegration < ActiveRecord::Migration[8.1]
  def change
    # Per-company Calendly OAuth connection, mirroring zoho_connections so both
    # integrations are stored and revoked the same way. Tokens are encrypted at
    # rest by the model (Active Record Encryption), never in plaintext here.
    create_table :calendly_connections do |t|
      t.references :company, null: false, foreign_key: true
      t.references :user, null: true, foreign_key: true

      t.text :access_token
      t.text :refresh_token
      t.datetime :token_expires_at

      # Identifiers Calendly's API addresses everything by. Stored so we don't
      # re-query /users/me on every scheduling-link creation.
      t.string :organization_uri
      t.string :calendly_user_uri
      t.string :email_address
      # The event type new booking links are generated from — the one the admin
      # configures with the working-day slots.
      t.string :default_event_type_uri

      # Set when we register the invitee.created / invitee.canceled webhook, so
      # we can tell a connected-but-unsubscribed account from a working one.
      t.string :webhook_subscription_uri

      t.integer :status, null: false, default: 0
      t.timestamps
    end

    add_index :calendly_connections, [ :company_id, :status ]

    # Booking state lives on the candidate: one interview per candidate, same
    # reasoning as the interview_at/interviewer_id columns already there.
    #
    # interview_link_sent_at is what "Booking link sent" reads from — the
    # candidate stays Shortlisted until Calendly confirms a booking, so this
    # timestamp (not the status) is how the UI shows we're waiting on them.
    add_column :candidates, :interview_link_sent_at, :datetime
    add_column :candidates, :calendly_scheduling_url, :string

    # invitee_uri is the join key for cancellation webhooks — Calendly sends it
    # on both invitee.created and invitee.canceled, so it is indexed for the
    # lookup that runs on every inbound hook.
    add_column :candidates, :calendly_invitee_uri, :string
    add_column :candidates, :calendly_event_uri, :string
    add_index :candidates, :calendly_invitee_uri
  end
end

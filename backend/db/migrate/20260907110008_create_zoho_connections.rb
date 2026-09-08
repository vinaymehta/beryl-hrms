class CreateZohoConnections < ActiveRecord::Migration[8.1]
  def change
    # Schema shell only — Phase 4 builds the actual OAuth flow/controllers.
    # access_token/refresh_token are plain-named columns because Active
    # Record Encryption (`encrypts :access_token`) transparently encrypts
    # in place; no "encrypted_" column-name prefix is needed or idiomatic.
    create_table :zoho_connections do |t|
      t.references :company, null: false, foreign_key: true
      t.references :user, null: true, foreign_key: true
      t.integer :connection_type, null: false, default: 0
      t.string :email_address, null: false
      t.text :access_token
      t.text :refresh_token
      t.datetime :token_expires_at
      t.string :scopes
      t.integer :status, null: false, default: 0
      t.datetime :last_synced_at

      t.timestamps
    end

    add_index :zoho_connections, [ :company_id, :user_id ]
  end
end

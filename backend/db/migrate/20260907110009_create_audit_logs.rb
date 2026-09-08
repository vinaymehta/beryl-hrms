class CreateAuditLogs < ActiveRecord::Migration[8.1]
  def change
    # Immutable log: no updated_at, and app code never issues UPDATE/DELETE
    # against this table. The additional hardening of REVOKE UPDATE, DELETE
    # at the database-role level is deliberately NOT applied here: this dev/
    # test setup uses a single Postgres role for both running migrations and
    # the app's runtime connection, so revoking from it would risk breaking
    # migrations/seeds/tests. In staging/production, create a distinct
    # low-privilege runtime role for the app and apply:
    #   REVOKE UPDATE, DELETE ON audit_logs FROM <runtime_role>;
    # so even a compromised app credential can't rewrite history.
    create_table :audit_logs, id: :bigserial do |t|
      t.references :company, null: true, foreign_key: true
      t.references :actor, null: true, foreign_key: { to_table: :users }
      t.string :action, null: false
      t.string :auditable_type
      t.bigint :auditable_id
      t.jsonb :before_changes
      t.jsonb :after_changes
      t.string :ip_address
      t.string :user_agent

      t.datetime :created_at, null: false
    end

    add_index :audit_logs, [ :company_id, :auditable_type, :auditable_id ], name: "index_audit_logs_on_company_and_auditable"
    add_index :audit_logs, [ :company_id, :created_at ]
  end
end

class CreateUserRoles < ActiveRecord::Migration[8.1]
  def change
    create_table :user_roles do |t|
      t.references :user, null: false, foreign_key: true
      t.references :role, null: false, foreign_key: true
      # Denormalized alongside user_id/role_id for a cheap, index-backed guard
      # against cross-tenant assignment; the authoritative check is the model
      # validation comparing user.company_id == role.company_id.
      t.references :company, null: false, foreign_key: true

      t.timestamps
    end

    add_index :user_roles, [ :user_id, :role_id ], unique: true, name: "index_user_roles_on_user_and_role"
  end
end

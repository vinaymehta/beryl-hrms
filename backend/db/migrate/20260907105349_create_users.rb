class CreateUsers < ActiveRecord::Migration[8.1]
  def change
    create_table :users do |t|
      t.references :company, null: false, foreign_key: true
      t.string :email_address, null: false
      t.string :password_digest, null: false
      t.string :first_name, null: false
      t.string :last_name, null: false
      t.datetime :email_verified_at
      t.integer :status, null: false, default: 0
      t.datetime :last_login_at

      t.timestamps
    end

    add_index :users, :email_address, unique: true
    add_index :users, [ :company_id, :status ]
  end
end

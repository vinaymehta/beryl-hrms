class CreateRoles < ActiveRecord::Migration[8.1]
  def change
    create_table :roles do |t|
      t.references :company, null: false, foreign_key: true
      t.string :name, null: false
      t.string :slug, null: false
      t.text :description
      t.boolean :system_default, null: false, default: false

      t.timestamps
    end

    add_index :roles, [ :company_id, :slug ], unique: true
  end
end

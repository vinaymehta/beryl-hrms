class CreateCompanies < ActiveRecord::Migration[8.1]
  def change
    create_table :companies do |t|
      t.string :name, null: false
      t.string :slug, null: false
      t.string :timezone, null: false, default: "UTC"
      t.integer :status, null: false, default: 0

      t.timestamps
    end

    add_index :companies, :slug, unique: true
  end
end

class CreateDesignations < ActiveRecord::Migration[8.1]
  def change
    create_table :designations do |t|
      t.references :company, null: false, foreign_key: true
      t.references :department, null: true, foreign_key: true
      t.string :title, null: false
      t.integer :level
      t.integer :status, null: false, default: 0

      t.timestamps
    end

    add_index :designations, [ :company_id, :title ]
  end
end

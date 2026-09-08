class CreateEmployees < ActiveRecord::Migration[8.1]
  def change
    # Shell table: core identity/org-placement columns only. Full HR profile
    # fields (DOB, address, bank details, tax info, documents) arrive in
    # Phase 5 via an additive migration — not built in this pass.
    create_table :employees do |t|
      t.references :company, null: false, foreign_key: true
      t.references :user, null: true, foreign_key: true
      t.string :employee_code, null: false
      t.string :first_name, null: false
      t.string :last_name, null: false
      t.references :department, null: true, foreign_key: true
      t.references :designation, null: true, foreign_key: true
      t.date :date_of_joining
      t.integer :status, null: false, default: 0

      t.timestamps
    end

    add_index :employees, [ :company_id, :employee_code ], unique: true
    add_index :employees, [ :company_id, :status ]
    add_index :employees, [ :company_id, :department_id ]
  end
end

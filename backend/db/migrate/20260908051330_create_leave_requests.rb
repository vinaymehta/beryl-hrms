class CreateLeaveRequests < ActiveRecord::Migration[8.1]
  def change
    create_table :leave_requests do |t|
      t.references :company, null: false, foreign_key: true
      t.references :employee, null: false, foreign_key: true
      t.string :leave_type
      t.date :start_date
      t.date :end_date
      t.text :reason
      t.integer :status, null: false, default: 0
      t.references :approved_by, null: true, foreign_key: { to_table: :users }
      t.datetime :approved_at

      t.timestamps
    end

    add_index :leave_requests, [ :company_id, :status ]
    add_index :leave_requests, [ :employee_id, :start_date ]
  end
end

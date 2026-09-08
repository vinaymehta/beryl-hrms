class CreateAttendanceRecords < ActiveRecord::Migration[8.1]
  def change
    create_table :attendance_records do |t|
      t.references :company, null: false, foreign_key: true
      t.references :employee, null: false, foreign_key: true
      t.date :date
      t.datetime :check_in_at
      t.datetime :check_out_at
      t.integer :status, null: false, default: 0
      t.text :notes

      t.timestamps
    end

    add_index :attendance_records, [ :employee_id, :date ], unique: true
    add_index :attendance_records, [ :company_id, :date ]
  end
end

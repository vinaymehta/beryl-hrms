# A month's salary slip for one employee, kept once generated: the PDF that
# was rendered (Active Storage, `pdf`), the amounts it printed, and whether —
# and to whom — it has been emailed. Each month is a pay run on the Salary
# page: slips are generated, reviewed, then sent, and the run reads its
# progress from these rows.
#
# One slip per employee per month; regenerating replaces the row's PDF and
# amounts rather than adding a second one.
class CreateSalarySlips < ActiveRecord::Migration[8.1]
  def change
    create_table :salary_slips do |t|
      # Covered by the (company_id, month) index below.
      t.references :company, null: false, foreign_key: true, index: false
      t.references :employee, null: false, foreign_key: true
      # Always the first of the month the slip is for.
      t.date :month, null: false
      t.integer :status, null: false, default: 0
      t.decimal :gross, precision: 12, scale: 2, null: false
      t.decimal :deductions, precision: 12, scale: 2, null: false
      t.decimal :net, precision: 12, scale: 2, null: false
      t.string :sent_to
      t.datetime :sent_at
      t.datetime :generated_at, null: false
      t.references :generated_by, foreign_key: { to_table: :users }
      t.references :sent_by, foreign_key: { to_table: :users }
      t.timestamps
    end
    add_index :salary_slips, %i[company_id employee_id month], unique: true
    add_index :salary_slips, %i[company_id month]
  end
end

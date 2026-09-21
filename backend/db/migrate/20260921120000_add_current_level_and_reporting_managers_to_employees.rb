class AddCurrentLevelAndReportingManagersToEmployees < ActiveRecord::Migration[8.1]
  def change
    # The HR "career level" ladder (Intern → Manager), distinct from both the
    # Designation (the job title) and from the RBAC Role the person's User
    # account carries. Nullable: existing employees have no level recorded
    # and backfilling one would be inventing data.
    add_column :employees, :current_level, :integer
    add_index :employees, [ :company_id, :current_level ]

    # Many-to-many: an employee may report to several managers (functional +
    # line), and a manager may have many reports. Deliberately a join table
    # rather than a reporting_manager_id column so neither side is capped at
    # one, and so the pairing can carry its own metadata later.
    create_table :employee_reporting_managers do |t|
      t.references :company, null: false, foreign_key: true
      t.references :employee, null: false, foreign_key: true
      t.references :manager, null: false, foreign_key: { to_table: :employees }

      t.timestamps
    end

    add_index :employee_reporting_managers, [ :employee_id, :manager_id ],
              unique: true, name: "index_employee_reporting_managers_uniqueness"
    add_index :employee_reporting_managers, [ :company_id, :manager_id ],
              name: "index_employee_reporting_managers_on_company_and_manager"
  end
end

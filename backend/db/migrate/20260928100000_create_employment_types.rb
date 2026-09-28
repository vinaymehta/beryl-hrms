# Employment type (Full-time, Contract, …) was a fixed enum on employees. It
# is now a per-company list managed from All Settings → Department → Employee
# Types, so each company can add, rename and remove its own.
#
# Existing values are carried over: every company is given the five types the
# enum had, and each employee is pointed at the row matching its old value.
class CreateEmploymentTypes < ActiveRecord::Migration[8.1]
  # The old enum, in its integer order.
  LEGACY = [ "Full-time", "Part-time", "Contract", "Intern", "Consultant" ].freeze

  def up
    create_table :employment_types do |t|
      t.references :company, null: false, foreign_key: true
      t.string :name, null: false
      t.text :description
      t.integer :status, null: false, default: 0
      t.timestamps
    end
    add_index :employment_types, %i[company_id name], unique: true

    add_reference :employees, :employment_type, foreign_key: true

    # Plain SQL: acts_as_tenant requires a current tenant, so model queries
    # would raise inside a migration.
    LEGACY.each do |name|
      execute <<~SQL.squish
        INSERT INTO employment_types (company_id, name, status, created_at, updated_at)
        SELECT id, #{quote(name)}, 0, NOW(), NOW() FROM companies
        ON CONFLICT DO NOTHING
      SQL
    end

    LEGACY.each_with_index do |name, legacy_value|
      execute <<~SQL.squish
        UPDATE employees SET employment_type_id = et.id
        FROM employment_types et
        WHERE et.company_id = employees.company_id
          AND et.name = #{quote(name)}
          AND employees.employment_type = #{legacy_value}
      SQL
    end

    remove_column :employees, :employment_type
  end

  def down
    add_column :employees, :employment_type, :integer
    LEGACY.each_with_index do |name, legacy_value|
      execute <<~SQL.squish
        UPDATE employees SET employment_type = #{legacy_value}
        FROM employment_types et
        WHERE et.id = employees.employment_type_id AND et.name = #{quote(name)}
      SQL
    end
    remove_reference :employees, :employment_type, foreign_key: true
    drop_table :employment_types
  end
end

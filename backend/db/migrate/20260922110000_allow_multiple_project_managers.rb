# §4 adds two hierarchy slots to the existing three:
#
#   Project Manager(s) — PLURAL, so one employee may have several
#   Department Head    — single, and separate from the Final Reviewer
#
# The existing UNIQUE (employee_id, manager_level) index capped every level at
# one row, which is incompatible with plural project managers. It is replaced
# with UNIQUE (employee_id, manager_level, manager_id): the same person still
# can't be added twice at the same level, but a level may now hold several
# people.
#
# "At most one" for primary / secondary / final / department_head therefore
# moves from the database to EmployeeManager, which enforces it per level. The
# guarantee is unchanged for those four; it is simply expressed where it can be
# made selective.
class AllowMultipleProjectManagers < ActiveRecord::Migration[8.1]
  def up
    remove_index :employee_managers, name: "index_employee_managers_uniqueness"
    add_index :employee_managers, [ :employee_id, :manager_level, :manager_id ],
              unique: true, name: "index_employee_managers_uniqueness"
  end

  def down
    # Reversing means going back to one row per level, so any surplus rows have
    # to go — keep the oldest of each level and drop the rest, or the unique
    # index below cannot be created.
    execute <<~SQL.squish
      DELETE FROM employee_managers
      WHERE id NOT IN (
        SELECT MIN(id) FROM employee_managers GROUP BY employee_id, manager_level
      )
    SQL

    remove_index :employee_managers, name: "index_employee_managers_uniqueness"
    add_index :employee_managers, [ :employee_id, :manager_level ],
              unique: true, name: "index_employee_managers_uniqueness"
  end
end

# Manager changes used to be logged once per manager level on every save,
# changed or not, with the level's code ("primary", "secondary", …) stored as
# the "from" value and no previous manager. Those rows can't be repaired — who
# held the level before was never recorded — so they are removed. New changes
# are logged only for the level that changed, with both names (Employee#
# record_manager_change), and carry the level in `note`, so they are never
# matched here.
class DeleteBrokenManagerChangeHistory < ActiveRecord::Migration[8.1]
  MANAGER_CHANGED = 5
  LEVEL_CODES = %w[primary secondary final department_head project_manager additional].freeze

  def up
    execute <<~SQL.squish
      DELETE FROM employee_employment_events
      WHERE event_type = #{MANAGER_CHANGED}
        AND note IS NULL
        AND from_value IN (#{LEVEL_CODES.map { |code| connection.quote(code) }.join(', ')})
    SQL
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end

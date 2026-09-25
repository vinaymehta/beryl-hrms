class AddTierToEmployeeManagers < ActiveRecord::Migration[8.1]
  # Ordering for the one level where order is the point.
  #
  # The review chain is three fixed slots (primary, secondary, final) and the
  # appraisal workflow reads them by name, so it cannot simply grow a fourth.
  # Reporting lines beyond it go in as `additional` rows, and a reporting line
  # only means something in order — "4th level" is a position, not a label —
  # which is what this column carries. Null everywhere else.
  def change
    add_column :employee_managers, :tier, :integer
  end
end

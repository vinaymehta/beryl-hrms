class EmployeeEmploymentEventPolicy < EmployeeRecordPolicy
  self.manage_key = "employee_history.view"
  self.employee_readable = true

  # Written by Employee callbacks and immutable — there is nothing to create,
  # edit or delete by hand, so those doors are shut rather than inherited.
  def create? = false
  def update? = false
  def destroy? = false
end

class EmployeeGoalPolicy < EmployeeRecordPolicy
  self.manage_key = "goals.manage"
  self.employee_readable = true
end

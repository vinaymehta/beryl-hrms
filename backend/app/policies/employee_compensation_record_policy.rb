class EmployeeCompensationRecordPolicy < EmployeeRecordPolicy
  self.manage_key = "compensation.manage"
  self.employee_readable = false
end

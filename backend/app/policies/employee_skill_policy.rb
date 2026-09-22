class EmployeeSkillPolicy < EmployeeRecordPolicy
  self.manage_key = "skills.manage"
  self.employee_readable = true
end

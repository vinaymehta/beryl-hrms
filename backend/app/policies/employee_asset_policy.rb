class EmployeeAssetPolicy < EmployeeRecordPolicy
  self.manage_key = "assets.manage"
  self.employee_readable = true
end

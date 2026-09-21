# One typed slot in an employee's reporting-manager hierarchy:
#
#   Employee → Primary Manager → (optional) Secondary Manager → Final Manager
#
# An ASSIGNMENT, not a system role. Nothing here touches User/UserRole/Role — a
# Primary Manager holds whatever system role they always held (usually just
# Employee), and being someone's manager grants no product permission at all.
#
# Modelled as rows rather than three FK columns on `employees` so each
# assignment is a record in its own right — listable, auditable, and carrying
# the level it was made at. The DB, not just this class, caps it at one row per
# (employee, level).
#
# Who may write these is EmployeePolicy#manage_reporting_managers? (permission
# key employees.manage_reporting_managers). An employee can READ their own
# hierarchy and change nothing about it.
class EmployeeManager < ApplicationRecord
  acts_as_tenant(:company)

  # `level_` prefix keeps `primary`/`final` clear of anything ActiveRecord or
  # the Employee status enum already defines.
  enum :manager_level, { primary: 0, secondary: 1, final: 2 }, prefix: :level, validate: true

  LEVELS = manager_levels.keys.freeze

  belongs_to :company
  belongs_to :employee, inverse_of: :manager_assignments
  belongs_to :manager, class_name: "Employee", inverse_of: :managed_assignments

  before_validation :set_company_from_employee

  validates :manager_level, uniqueness: { scope: :employee_id }
  validate :manager_is_not_self
  # Same guard UserRole makes for roles: a raw id out of params must never let
  # a Company-A employee be given a Company-B manager, whatever the default
  # scope happens to be at the time.
  validate :employee_and_manager_same_company
  validate :manager_is_active, on: :create

  private
    def set_company_from_employee
      self.company_id ||= employee&.company_id
    end

    def manager_is_not_self
      return if employee_id.nil? || manager_id.nil?

      errors.add(:manager, "can't be the employee themselves") if employee_id == manager_id
    end

    def employee_and_manager_same_company
      return if employee.nil? || manager.nil?

      errors.add(:manager, "must belong to the same company as the employee") if employee.company_id != manager.company_id
    end

    # "Any active employee can be selected as a manager" — no restriction by
    # system role, by design. Checked on create only, so an existing assignment
    # survives that person later being deactivated; unwinding a reporting line
    # is a deliberate act, not something an unrelated profile edit should trigger.
    def manager_is_active
      return if manager.nil?

      errors.add(:manager, "must be an active employee") unless manager.active?
    end
end

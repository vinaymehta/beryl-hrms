# One typed slot in an employee's reporting hierarchy (scope §4):
#
#   Primary Manager     — exactly one
#   Secondary Manager   — at most one
#   Project Manager(s)  — MANY; the one plural slot
#   Department Head     — at most one, and NOT the Final Reviewer
#   Final Manager       — exactly one
#
# An ASSIGNMENT, not a system role. Nothing here touches User/UserRole/Role, and
# being anyone's manager grants no product permission.
#
# All five share this one table. The database's
# UNIQUE (employee_id, manager_level, manager_id) stops the same person being
# added twice at the same level; "at most one person per level" is enforced here
# instead, for SINGLE_LEVELS only, because project managers are deliberately
# exempt from it.
class EmployeeManager < ApplicationRecord
  acts_as_tenant(:company)

  # Integers are stable: the first three predate §4's additions and are
  # referenced by existing rows.
  enum :manager_level,
       { primary: 0, secondary: 1, final: 2, project_manager: 3, department_head: 4 },
       prefix: :level, validate: true

  # Levels that hold at most one person.
  SINGLE_LEVELS = %w[primary secondary final department_head].freeze
  # Levels that may hold several. §4 says "Project Manager(s)".
  MULTI_LEVELS = %w[project_manager].freeze
  LEVELS = (SINGLE_LEVELS + MULTI_LEVELS).freeze

  # Level → the association name on Employee. Not derivable: a department head
  # is not a "department_head_manager", and the plural slot reads as a list.
  ASSOCIATION_FOR_LEVEL = {
    "primary" => :primary_manager,
    "secondary" => :secondary_manager,
    "final" => :final_manager,
    "department_head" => :department_head,
    "project_manager" => :project_managers
  }.freeze

  # The review chain, in order — the three slots the appraisal workflow reads.
  # Project Manager and Department Head are deliberately NOT in it.
  REVIEW_CHAIN_LEVELS = %w[primary secondary final].freeze

  def self.single_level?(level) = SINGLE_LEVELS.include?(level.to_s)

  belongs_to :company
  belongs_to :employee, inverse_of: :manager_assignments
  belongs_to :manager, class_name: "Employee", inverse_of: :managed_assignments

  before_validation :set_company_from_employee

  validates :manager_id, uniqueness: { scope: %i[employee_id manager_level] }
  validate :single_level_holds_one_person
  validate :manager_is_not_self
  # Same guard UserRole makes for roles: a raw id out of params must never let
  # a Company-A employee be given a Company-B manager.
  validate :employee_and_manager_same_company
  validate :manager_is_active, on: :create

  scope :for_level, ->(level) { where(manager_level: level) }

  private
    def set_company_from_employee
      self.company_id ||= employee&.company_id
    end

    # Replaces the guarantee the dropped database index used to give, but only
    # where it should apply. Project managers fall straight through.
    def single_level_holds_one_person
      return if manager_level.blank? || employee_id.blank?
      return unless self.class.single_level?(manager_level)

      clash = self.class.where(employee_id: employee_id, manager_level: manager_level)
      clash = clash.where.not(id: id) if persisted?
      return unless clash.exists?

      errors.add(:manager_level, "already has a #{manager_level.humanize.downcase} assigned")
    end

    def manager_is_not_self
      return if employee_id.nil? || manager_id.nil?

      errors.add(:manager, "can't be the employee themselves") if employee_id == manager_id
    end

    def employee_and_manager_same_company
      return if employee.nil? || manager.nil?

      errors.add(:manager, "must belong to the same company as the employee") if employee.company_id != manager.company_id
    end

    # "Any active employee can be selected" — no restriction by system role.
    # Checked on create only, so an existing assignment survives that person
    # later being deactivated.
    def manager_is_active
      return if manager.nil?

      errors.add(:manager, "must be an active employee") unless manager.active?
    end
end

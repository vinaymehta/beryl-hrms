class Employee < ApplicationRecord
  acts_as_tenant(:company)

  # Raised when a request would leave the reporting-manager hierarchy
  # structurally invalid. Rescued by EmployeesController into a 422, the same as
  # any other bad field on the form.
  class ManagerHierarchyError < StandardError; end

  # Bank details/tax IDs/government IDs deliberately not here — Phase 6
  # (Accounts/Payroll) concern, not HR profile data.
  enum :status, { active: 0, inactive: 1, offboarded: 2 }, default: :active

  # The HR career ladder, kept deliberately separate from two things it is
  # easy to confuse it with:
  #   • Designation — the job TITLE ("Software Engineer"), its own tenant-owned
  #     record, editable from Departments/Designations.
  #   • Role — an RBAC Role on the linked User (Admin/HR/Employee), which
  #     decides what the person may DO in the product.
  # This is neither: it is where they sit on the seniority scale.
  # `level_` prefix so `manager` can't collide with Employee#active? from the
  # status enum, nor with the manager associations below.
  # validate: — without it, assigning a level that isn't on the ladder raises
  # ArgumentError from the setter, which surfaces as a 500 rather than the 422
  # every other bad field on this form produces. allow_nil because the level
  # is genuinely optional: existing records have none.
  enum :current_level,
       { intern: 0, junior: 1, senior: 2, lead: 3, manager: 4 },
       prefix: :level, validate: { allow_nil: true }

  CURRENT_LEVELS = current_levels.keys.freeze

  belongs_to :company
  belongs_to :user, optional: true, inverse_of: :employee_record
  belongs_to :department, optional: true
  belongs_to :designation, optional: true
  has_many :leave_requests, dependent: :destroy
  has_many :attendance_records, dependent: :destroy
  has_many :documents, dependent: :destroy

  # --- Reporting manager hierarchy ------------------------------------------
  # Employee → Primary Manager → (optional) Secondary Manager → Final Manager.
  # `manager_assignments` are the slots filled FOR this employee;
  # `managed_assignments` the slots where they are somebody else's manager.
  # Both dependent: :destroy so removing an employee can't leave a dangling
  # reporting line in either direction.
  has_many :manager_assignments,
           class_name: "EmployeeManager",
           dependent: :destroy,
           inverse_of: :employee
  has_many :managed_assignments,
           class_name: "EmployeeManager",
           foreign_key: :manager_id,
           dependent: :destroy,
           inverse_of: :manager

  # has_one per level rather than a single has_many every caller has to filter:
  # the cardinality (at most one each) IS the rule, so the associations should
  # state it. The DB's unique index on (employee_id, manager_level) is what
  # actually guarantees it.
  EmployeeManager::LEVELS.each do |level|
    has_one :"#{level}_manager_assignment",
            -> { where(manager_level: EmployeeManager.manager_levels[level]) },
            class_name: "EmployeeManager",
            inverse_of: :employee,
            dependent: nil
    has_one :"#{level}_manager",
            through: :"#{level}_manager_assignment",
            source: :manager
  end

  has_one_attached :profile_photo

  validates :employee_code, presence: true, uniqueness: { scope: :company_id }
  validates :first_name, :last_name, presence: true

  # The hierarchy as the API and the UI talk about it.
  def manager_hierarchy
    { "primary" => primary_manager, "secondary" => secondary_manager, "final" => final_manager }
  end

  # Primary and Final are both required for a complete hierarchy; Secondary is
  # optional. Reported rather than enforced as a blanket model validation — see
  # #enforce_hierarchy_shape! for exactly where the line is drawn and why.
  def manager_hierarchy_complete?
    assigned_manager_id("primary").present? && assigned_manager_id("final").present?
  end

  def full_name
    "#{first_name} #{last_name}".strip
  end

  # Applies the submitted slots of the reporting-manager hierarchy.
  #
  # `assignments` is keyed by level, and ONLY the keys present are touched — an
  # edit that never mentions the secondary manager must leave it alone, not
  # read "absent" as "remove". A present key with a blank value clears that slot.
  #
  # Raises (rolling the caller's transaction back) rather than half-applying.
  # Authorization is the CALLER's job — EmployeePolicy#manage_reporting_managers?.
  def assign_managers!(assignments)
    assignments.each do |level, manager_id|
      level = level.to_s
      raise ManagerHierarchyError, "#{level} is not a manager level" unless EmployeeManager::LEVELS.include?(level)

      apply_manager_slot(level, manager_id)
    end

    reset_manager_associations
    enforce_hierarchy_shape!
  end

  private
    def apply_manager_slot(level, manager_id)
      existing = manager_assignments.find_by(manager_level: level)

      if manager_id.blank?
        existing&.destroy!
      elsif existing.nil?
        manager_assignments.create!(manager_level: level, manager_id: manager_id)
      elsif existing.manager_id != manager_id.to_i
        # update! rather than destroy-and-create so the slot keeps its identity
        # (and its created_at) across a reassignment.
        existing.update!(manager_id: manager_id)
      end
    end

    def reset_manager_associations
      manager_assignments.reset
      EmployeeManager::LEVELS.each do |level|
        association(:"#{level}_manager_assignment").reset
        association(:"#{level}_manager").reset
      end
    end

    def assigned_manager_id(level)
      manager_assignments.find_by(manager_level: level)&.manager_id
    end

    # The Primary Manager anchors the chain: a Secondary supplements them (it is
    # the cross-project/shared-reporting slot, not a substitute), and a Final
    # sits above them. Assigning either without a Primary would leave a
    # hierarchy with a hole at the top, so any assignment at all requires one.
    #
    # Note what is deliberately NOT enforced here: that a Final is present
    # whenever a Primary is. Both are required for a COMPLETE hierarchy, and the
    # form marks them so — but a hard model validation would make the very first
    # employee in a brand-new company impossible to create (there is nobody to
    # pick yet) and would fail unrelated edits on records predating this
    # feature. Completeness is surfaced instead, via
    # #manager_hierarchy_complete?, and flagged in the UI.
    def enforce_hierarchy_shape!
      return if assigned_manager_id("primary").present?
      return if assigned_manager_id("secondary").blank? && assigned_manager_id("final").blank?

      raise ManagerHierarchyError, "A primary manager is required before assigning a secondary or final manager"
    end
end

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
  # §3's employment TYPE, a different axis from `status` (the lifecycle above).
  enum :employment_type,
       { full_time: 0, part_time: 1, contract: 2, intern: 3, consultant: 4 },
       prefix: :employment, validate: { allow_nil: true }

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

  # has_one for the single-valued levels rather than a has_many every caller
  # has to filter: the cardinality IS the rule, so the association should state
  # it. EmployeeManager enforces it (the DB index can't, now that one level is
  # plural).
  #
  # Association names come from EmployeeManager::ASSOCIATION_FOR_LEVEL — a
  # department head is not a "department_head_manager".
  EmployeeManager::SINGLE_LEVELS.each do |level|
    association = EmployeeManager::ASSOCIATION_FOR_LEVEL.fetch(level)

    has_one :"#{association}_assignment",
            -> { where(manager_level: EmployeeManager.manager_levels[level]) },
            class_name: "EmployeeManager",
            inverse_of: :employee,
            dependent: nil
    has_one association, through: :"#{association}_assignment", source: :manager
  end

  # §4's one plural slot. A has_many, because an employee may sit on several
  # projects at once — and deliberately separate from the review chain, which
  # the appraisal workflow reads and this has no part in.
  has_many :project_manager_assignments,
           -> { where(manager_level: EmployeeManager.manager_levels["project_manager"]) },
           class_name: "EmployeeManager",
           inverse_of: :employee,
           dependent: nil
  has_many :project_managers, through: :project_manager_assignments, source: :manager

  # --- Appraisals -----------------------------------------------------------
  # `appraisals` are this employee's own; the three manager associations are the
  # ones they REVIEW. nullify rather than destroy on the reviewer side: removing
  # a manager must not take somebody else's appraisal history with it.
  # --- Phase 1 history + Phase 5 continuous performance --------------------
  # dependent: :destroy throughout: these records only mean anything in the
  # context of the employee they describe.
  has_many :employment_events,
           -> { chronological },
           class_name: "EmployeeEmploymentEvent", dependent: :destroy, inverse_of: :employee
  has_many :compensation_records,
           -> { chronological },
           class_name: "EmployeeCompensationRecord", dependent: :destroy, inverse_of: :employee
  has_many :assets, class_name: "EmployeeAsset", dependent: :nullify, inverse_of: :employee
  has_many :goals, -> { newest_first }, class_name: "EmployeeGoal", dependent: :destroy, inverse_of: :employee
  has_many :skills, -> { order(:name) }, class_name: "EmployeeSkill", dependent: :destroy, inverse_of: :employee
  has_many :trainings, -> { newest_first }, class_name: "EmployeeTraining", dependent: :destroy, inverse_of: :employee
  has_many :improvement_plans,
           -> { newest_first },
           class_name: "PerformanceImprovementPlan", dependent: :destroy, inverse_of: :employee

  has_many :appraisals, dependent: :destroy
  has_many :appraisals_as_primary_manager,
           class_name: "Appraisal", foreign_key: :primary_manager_id, dependent: :nullify, inverse_of: :primary_manager
  has_many :appraisals_as_secondary_manager,
           class_name: "Appraisal", foreign_key: :secondary_manager_id, dependent: :nullify, inverse_of: :secondary_manager
  has_many :appraisals_as_final_manager,
           class_name: "Appraisal", foreign_key: :final_manager_id, dependent: :nullify, inverse_of: :final_manager

  has_one_attached :profile_photo

  validates :employee_code, presence: true, uniqueness: { scope: :company_id }
  validates :first_name, :last_name, presence: true

  # §3: "structured history rather than overwriting past values", and §26:
  # historical records must not change when current attributes do. Recorded by
  # callback rather than by a form — history somebody has to remember to write
  # down is not history. The events themselves are immutable.
  after_create :record_joining_event
  after_update :record_employment_changes

  # `has_one :through` gives a reader for the RECORD but not for its id, and
  # plenty of callers only want the id (snapshotting a cycle's reviewers, say).
  # Defined explicitly rather than reaching through the association every time.
  EmployeeManager::SINGLE_LEVELS.each do |level|
    define_method(:"#{EmployeeManager::ASSOCIATION_FOR_LEVEL.fetch(level)}_id") { assigned_manager_id(level) }
  end

  def project_manager_ids
    manager_assignments_for("project_manager").map(&:manager_id)
  end

  # The full §4 hierarchy as the API and the UI talk about it.
  #
  # The three review-chain slots plus the two that sit outside it. Department
  # Head is its own entry and is never derived from the Final Reviewer — §4
  # lists them separately, and an employee's department head must not be
  # treated as their final reviewer.
  def manager_hierarchy
    {
      "primary" => primary_manager,
      "secondary" => secondary_manager,
      "final" => final_manager,
      "department_head" => department_head,
      "project_managers" => project_managers.to_a
    }
  end

  # Primary and Final are both required for a complete hierarchy; Secondary is
  # optional. Reported rather than enforced as a blanket model validation — see
  # #enforce_hierarchy_shape! for exactly where the line is drawn and why.
  # Primary and Final only: the review chain is what a cycle needs. Project
  # managers and a department head are orthogonal and never block an appraisal.
  def manager_hierarchy_complete?
    assigned_manager_id("primary").present? && assigned_manager_id("final").present?
  end

  def full_name
    "#{first_name} #{last_name}".strip
  end

  # The employment fields whose changes are worth a history entry, mapped to
  # the event type each produces. Address and phone are deliberately absent:
  # correcting a typo in a postcode is not an employment event.
  TRACKED_EMPLOYMENT_CHANGES = {
    "designation_id" => :designation_changed,
    "department_id" => :department_changed,
    "status" => :status_changed,
    "employment_type" => :employment_type_changed,
    "work_location" => :location_changed
  }.freeze

  # Applies the submitted slots of the reporting-manager hierarchy.
  #
  # `assignments` is keyed by level, and ONLY the keys present are touched — an
  # edit that never mentions the secondary manager must leave it alone, not
  # read "absent" as "remove". A present key with a blank value clears that slot.
  #
  # Raises (rolling the caller's transaction back) rather than half-applying.
  # Authorization is the CALLER's job — EmployeePolicy#manage_reporting_managers?.
  # Single-valued levels take an id (or blank to clear); `project_manager`
  # takes an ARRAY of ids and is synced as a set.
  def assign_managers!(assignments)
    assignments.each do |level, value|
      level = level.to_s
      raise ManagerHierarchyError, "#{level} is not a manager level" unless EmployeeManager::LEVELS.include?(level)

      if EmployeeManager.single_level?(level)
        apply_manager_slot(level, value)
      else
        sync_multi_level(level, value)
      end
    end

    reset_manager_associations
    enforce_hierarchy_shape!
    record_manager_change(assignments.keys)
  end

  # Reads the loaded association when it is already in memory, so a
  # `includes(:manager_assignments)` on a list doesn't turn into N queries.
  def assigned_manager_id(level)
    if manager_assignments.loaded?
      manager_assignments.detect { |a| a.manager_level == level.to_s }&.manager_id
    else
      manager_assignments.find_by(manager_level: level)&.manager_id
    end
  end

  private
    def record_joining_event
      employment_events.create!(
        event_type: :joined,
        to_value: designation&.title || department&.name,
        effective_on: date_of_joining || Date.current,
        recorded_by: Current.user
      )
    end

    def record_employment_changes
      TRACKED_EMPLOYMENT_CHANGES.each do |attribute, event_type|
        change = previous_changes[attribute]
        next if change.blank?

        employment_events.create!(
          event_type: event_type,
          from_value: readable_employment_value(attribute, change.first),
          to_value: readable_employment_value(attribute, change.last),
          effective_on: Date.current,
          recorded_by: Current.user
        )
      end
    end

    def record_manager_change(levels)
      levels.each do |level|
        association = EmployeeManager::ASSOCIATION_FOR_LEVEL.fetch(level.to_s)
        assigned = public_send(association)
        # The plural slot records the whole set, so the history entry reads as
        # "who are the project managers now" rather than one line per person.
        to_value = assigned.is_a?(Enumerable) ? assigned.map(&:full_name).join(", ").presence : assigned&.full_name

        employment_events.create!(
          event_type: :manager_changed,
          from_value: level.to_s,
          to_value: to_value,
          effective_on: Date.current,
          recorded_by: Current.user
        )
      end
    end

    # Names, not ids: an event has to stay readable after the record it points
    # at is renamed or removed (§26).
    def readable_employment_value(attribute, raw)
      return nil if raw.blank?

      case attribute
      when "designation_id" then Designation.find_by(id: raw)&.title
      when "department_id" then Department.find_by(id: raw)&.name
      when "status" then self.class.statuses.key(raw) || raw
      when "employment_type" then self.class.employment_types.key(raw) || raw
      else raw.to_s
      end
    end

    # Adds and removes only what changed, so an unrelated save doesn't churn the
    # rows (and their history entries).
    def sync_multi_level(level, manager_ids)
      desired = Array(manager_ids).compact_blank.map(&:to_i).uniq
      current = manager_assignments_for(level).map(&:manager_id)

      manager_assignments.where(manager_level: level, manager_id: current - desired).destroy_all
      (desired - current).each do |manager_id|
        manager_assignments.create!(manager_level: level, manager_id: manager_id)
      end
    end

    def manager_assignments_for(level)
      if manager_assignments.loaded?
        manager_assignments.select { |a| a.manager_level == level.to_s }
      else
        manager_assignments.where(manager_level: level).to_a
      end
    end

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
      EmployeeManager::SINGLE_LEVELS.each do |level|
        association_name = EmployeeManager::ASSOCIATION_FOR_LEVEL.fetch(level)
        association(:"#{association_name}_assignment").reset
        association(association_name).reset
      end
      association(:project_manager_assignments).reset
      association(:project_managers).reset
    end



    # The Primary Manager anchors the REVIEW CHAIN: a Secondary supplements them
    # and a Final sits above them, so neither can stand without a Primary.
    #
    # Project Managers and the Department Head are deliberately exempt — §4
    # lists them as relationships alongside the chain, not inside it, and an
    # employee can perfectly well have a department head before their review
    # line is set up.
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

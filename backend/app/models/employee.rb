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

  # The reporting line past the third level. Ordered by tier in the association
  # itself rather than at each call site: an unordered reporting line is wrong
  # rather than merely untidy, so the ordering belongs where the rows are read.
  has_many :additional_manager_assignments,
           -> { where(manager_level: EmployeeManager.manager_levels["additional"]).order(:tier, :id) },
           class_name: "EmployeeManager",
           inverse_of: :employee,
           dependent: nil
  has_many :additional_managers, through: :additional_manager_assignments, source: :manager

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

  # --- Joining rules --------------------------------------------------------
  #
  # Every rule below is scoped to the value ACTUALLY CHANGING, not to the
  # record. That is deliberate and load-bearing: these are hiring rules
  # introduced after the fact, and the database is full of people who predate
  # them — someone hired last year, someone whose stored phone has no country
  # code. Validating unconditionally would make those records unsaveable, so
  # correcting an unrelated typo on an old profile would fail on a rule about
  # their date of birth. A rule that stops you fixing a name is not a rule
  # worth having.

  # The minimum age at which somebody may be added.
  MINIMUM_AGE_YEARS = 22
  # How far ahead a joining date may be set. Beyond this it is a plan, not a
  # start date, and it is nearly always a typo in the year.
  MAX_JOINING_DAYS_AHEAD = 30

  GENDERS = %w[male female].freeze
  WORK_LOCATIONS = %w[Faridabad Delhi Gurgaon].freeze

  # +91 optional, then a ten-digit number starting 6-9, which is every mobile
  # series India issues. Spaces and dashes are tolerated in what is typed and
  # stripped before this runs.
  INDIAN_PHONE = /\A(?:\+?91)?[6-9]\d{9}\z/
  POSTAL_CODE = /\A\d{6}\z/

  validates :employee_code, presence: true,
            uniqueness: { scope: :company_id, message: "already in use" }
  validates :first_name, :last_name, presence: true

  validates :gender, inclusion: { in: GENDERS, message: "must be male or female" },
            allow_blank: true, if: :will_save_change_to_gender?
  validates :work_location, inclusion: { in: WORK_LOCATIONS, message: "isn't one of the available locations" },
            allow_blank: true, if: :will_save_change_to_work_location?
  validates :postal_code, format: { with: POSTAL_CODE, message: "must be exactly 6 digits" },
            allow_blank: true, if: :will_save_change_to_postal_code?
  validates :phone, format: { with: INDIAN_PHONE, message: "must be a valid Indian mobile number" },
            allow_blank: true, if: :will_save_change_to_phone?
  # The same rule as `phone`, and for the same reason: a number nobody can ring
  # is worse on an emergency contact than anywhere else on this form.
  validates :emergency_contact_phone,
            format: { with: INDIAN_PHONE, message: "must be a valid Indian mobile number" },
            allow_blank: true, if: :will_save_change_to_emergency_contact_phone?
  # Checked here as well as in the form because the form is not the only way in
  # — an import or a direct API call reaches this column too.
  validates :personal_email, format: { with: URI::MailTo::EMAIL_REGEXP, message: "isn't a valid email address" },
            allow_blank: true, if: :will_save_change_to_personal_email?

  validate :date_of_birth_meets_minimum_age, if: :will_save_change_to_date_of_birth?
  validate :date_of_joining_within_window, if: :will_save_change_to_date_of_joining?

  # Typed with spaces, dashes or brackets; stored as digits so two people who
  # entered the same number the same way are stored the same way.
  normalizes :phone, with: ->(value) { value.to_s.gsub(/[\s()\-]/, "").presence }
  normalizes :emergency_contact_phone, with: ->(value) { value.to_s.gsub(/[\s()\-]/, "").presence }
  normalizes :personal_email, with: ->(value) { value.to_s.strip.downcase.presence }

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
      "project_managers" => project_managers.to_a,
      "additional_managers" => additional_managers.to_a
    }
  end

  # A 1st level manager, and that is the whole rule.
  #
  # It used to require a Final as well. That matched a form which marked both
  # as required, and stopped doing so when the 2nd and 3rd levels became
  # optional: the flag would then have reported half the directory
  # "Incomplete" for leaving out a field the form itself calls optional, and a
  # warning that fires on correctly-filled records is one people learn to
  # ignore.
  #
  # What is given up by narrowing it: this no longer warns ahead of time about
  # a review chain with no final step. An appraisal walks primary → secondary
  # → final, and `final` is the step that releases the result, so an employee
  # without one has a chain that ends nowhere — but that now surfaces when the
  # cycle reaches it rather than on the directory beforehand.
  #
  # Reported, never enforced — see #enforce_hierarchy_shape! for where the
  # hard line actually is. Project managers, a department head and the
  # additional tiers are all orthogonal and never counted here.
  def manager_hierarchy_complete?
    assigned_manager_id("primary").present?
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
    submitted = assignments.to_h { |level, value| [ level.to_s, value ] }
    submitted.each_key do |level|
      raise ManagerHierarchyError, "#{level} is not a manager level" unless EmployeeManager::LEVELS.include?(level)
    end

    release_moved_managers(submitted)

    submitted.each do |level, value|
      if EmployeeManager.single_level?(level)
        apply_manager_slot(level, value)
      else
        sync_multi_level(level, value)
      end
    end

    reset_manager_associations
    enforce_hierarchy_shape!
    record_manager_change(submitted.keys)
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

  # The latest date of birth that still makes somebody old enough to be added.
  # Exposed so the form can cap its calendar with the same number the server
  # enforces, rather than hard-coding 22 in two places that can drift.
  def self.minimum_birth_date(today = Date.current)
    today - MINIMUM_AGE_YEARS.years
  end

  private
    def date_of_birth_meets_minimum_age
      return if date_of_birth.blank?

      if date_of_birth > Date.current
        errors.add(:date_of_birth, "can't be in the future")
      elsif date_of_birth > self.class.minimum_birth_date
        errors.add(:date_of_birth, "must be at least #{MINIMUM_AGE_YEARS} years ago")
      end
    end

    def date_of_joining_within_window
      return if date_of_joining.blank?

      if date_of_joining < Date.current
        errors.add(:date_of_joining, "can't be in the past")
      elsif date_of_joining > Date.current + MAX_JOINING_DAYS_AHEAD.days
        errors.add(:date_of_joining, "can't be more than #{MAX_JOINING_DAYS_AHEAD} days from today")
      end
    end

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
      renumber_tiers(desired) if level == "additional"
    end

    # Tier is the row's POSITION in the submitted list, so it is rewritten from
    # that list every time rather than stamped once at creation: dropping the
    # 4th-level manager has to promote the 5th, not leave a hole in the chain.
    def renumber_tiers(desired)
      manager_assignments_for("additional").each do |assignment|
        position = desired.index(assignment.manager_id) || desired.size
        assignment.update_column(:tier, EmployeeManager::FIRST_ADDITIONAL_TIER + position)
      end
    end

    def manager_assignments_for(level)
      if manager_assignments.loaded?
        manager_assignments.select { |a| a.manager_level == level.to_s }
      else
        manager_assignments.where(manager_level: level).to_a
      end
    end

    # Clears the old rows of anybody MOVING between two slots that this same
    # request is rewriting, before any of the new ones are written.
    #
    # Nobody may hold two slots at once (EmployeeManager#manager_holds_only_one_slot)
    # and the slots are applied one at a time, so swapping the 1st and 3rd
    # level managers would otherwise fail against the half-applied state — the
    # first collides with a row this very request is about to delete.
    #
    # Deliberately limited to levels the request MENTIONS. Releasing a slot it
    # said nothing about would quietly move somebody out of a relationship
    # nobody asked to change; left in place, the one-slot rule refuses the save
    # and names the slot they already hold, which is the useful answer.
    def release_moved_managers(submitted)
      levels = submitted.keys.map { |level| EmployeeManager.manager_levels[level] }
      desired = submitted.flat_map { |_level, value| Array(value) }.compact_blank.map(&:to_i).uniq
      return if desired.empty?

      keeping = submitted.to_h do |level, value|
        [ EmployeeManager.manager_levels[level], Array(value).compact_blank.map(&:to_i) ]
      end

      manager_assignments.where(manager_id: desired, manager_level: levels).find_each do |assignment|
        next if keeping[assignment.manager_level_before_type_cast]&.include?(assignment.manager_id)

        assignment.destroy!
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
      association(:additional_manager_assignments).reset
      association(:additional_managers).reset
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
    # whenever a Primary is. A hard model validation would make the very first
    # employee in a brand-new company impossible to create (there is nobody to
    # pick yet) and would fail unrelated edits on records predating this
    # feature. A Final is not required for completeness either any more — see
    # #manager_hierarchy_complete?.
    def enforce_hierarchy_shape!
      return if assigned_manager_id("primary").present?
      return if assigned_manager_id("secondary").blank? && assigned_manager_id("final").blank?

      raise ManagerHierarchyError, "A primary manager is required before assigning a secondary or final manager"
    end
end

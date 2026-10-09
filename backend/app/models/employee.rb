class Employee < ApplicationRecord
  acts_as_tenant(:company)

  # Raised when a request would leave the reporting-manager hierarchy
  # structurally invalid. Rescued by EmployeesController into a 422, the same as
  # any other bad field on the form.
  class ManagerHierarchyError < StandardError; end

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
  # §3's employment TYPE, a different axis from `status` (the lifecycle above).
  # A per-company list managed from All Settings — see EmploymentType.
  belongs_to :employment_type, optional: true
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
  # +91 optional, then a ten-digit number starting 6-9, which is every mobile
  # series India issues. Spaces and dashes are tolerated in what is typed and
  # stripped before this runs.
  INDIAN_PHONE = /\A(?:\+?91)?[6-9]\d{9}\z/
  POSTAL_CODE = /\A\d{6}\z/
  IFSC_CODE = /\A[A-Z]{4}0[A-Z0-9]{6}\z/
  BANK_ACCOUNT_NUMBER = /\A\d{9,18}\z/
  AADHAAR_NUMBER = /\A\d{12}\z/
  PAN_NUMBER = /\A[A-Z]{5}\d{4}[A-Z]\z/

  # Enough for a personal and a work mobile plus a landline or two; a cap so the
  # list can't grow without limit through the API.
  MAX_PHONES = 5
  MAX_EMERGENCY_CONTACTS = 5
  # What one emergency contact is made of. Stored as jsonb rows of exactly
  # these keys — anything else that arrives is dropped by the normalizer.
  EMERGENCY_CONTACT_KEYS = %w[name relation phone].freeze
  # Identity documents besides Aadhaar and PAN ({ label, number }), e.g. Passport, Driving licence, UAN.
  MAX_OTHER_IDENTITY_NUMBERS = 10
  OTHER_IDENTITY_NUMBER_KEYS = %w[label number].freeze

  # The same 2 MB ceiling as a signature on an appraisal letter
  # (Appraisals::SignLetter): a picture, and not a large one. Declared type →
  # the bytes a real file of that type starts with; as there, both must agree,
  # because the type is only what the browser claims. (WebP is "RIFF", four
  # size bytes, then "WEBP".)
  PROFILE_PHOTO_TYPES = {
    "image/png" => ->(head) { head.start_with?("\x89PNG\r\n\x1A\n".b) },
    "image/jpeg" => ->(head) { head.start_with?("\xFF\xD8\xFF".b) },
    "image/webp" => ->(head) { head.start_with?("RIFF".b) && head[8, 4] == "WEBP".b }
  }.freeze
  PROFILE_PHOTO_MAX_BYTES = 2.megabytes

  # Only the employee themselves and Admin/HR ever receive these (see
  # EmployeePolicy#view_sensitive_details?), and they are never written to an
  # audit log or a history entry in the clear.
  SENSITIVE_ATTRIBUTES = %w[bank_account_number aadhaar_number pan_number other_identity_numbers].freeze

  validates :employee_code, presence: true,
            uniqueness: { scope: :company_id, message: "already in use" }
  # Never below the company's Initial ID (Settings → Other → Initial ID).
  # Checked only when the code changes, so records that predate the setting
  # stay saveable.
  validate :employee_code_not_below_initial, if: :will_save_change_to_employee_code?
  validates :first_name, :last_name, presence: true

  # The login account carries the person's name too (top bar, emails, notifications). It was only copied when
  # the account was created, so renaming the employee — or linking an existing account — left the old name on
  # the account. Keep it the same as the employee record.
  after_save :sync_account_name, if: -> { user_id.present? && (saved_change_to_first_name? || saved_change_to_last_name? || saved_change_to_user_id?) }

  # Gender, work location and the joining-date window are the employee FORM's
  # rules only (frontend schemas.ts), not the model's — so seeds, imports and
  # historical records with other values still save.
  validates :postal_code, format: { with: POSTAL_CODE, message: "must be exactly 6 digits" },
            allow_blank: true, if: :will_save_change_to_postal_code?
  # Each NEW number on the list is checked, not every number on it: a phone
  # stored before this rule existed must not make the list unsaveable when
  # somebody adds a second one. Same reasoning as the rest of this section.
  validate :phones_are_valid, if: :will_save_change_to_phones?
  # The same rule for an emergency contact's phone, and for the same reason: a
  # number nobody can ring is worse there than anywhere else on this form.
  validate :emergency_contacts_are_valid, if: :will_save_change_to_emergency_contacts?
  validate :other_identity_numbers_are_valid, if: :will_save_change_to_other_identity_numbers?
  # Checked here as well as in the form because the form is not the only way in
  # — an import or a direct API call reaches this column too.
  validates :personal_email, format: { with: URI::MailTo::EMAIL_REGEXP, message: "isn't a valid email address" },
            allow_blank: true, if: :will_save_change_to_personal_email?

  validate :date_of_birth_meets_minimum_age, if: :will_save_change_to_date_of_birth?

  # Bank details and identity numbers. Optional, and checked only when they
  # change, like everything else here. Formats are the issuers' own:
  #   • IFSC — 4 letters (the bank), a literal 0, then 6 letters/digits (the branch).
  #   • Account number — 9 to 18 digits, the range Indian banks issue.
  #   • Aadhaar — 12 digits. PAN — 5 letters, 4 digits, 1 letter.
  validates :bank_ifsc_code, format: { with: IFSC_CODE, message: "must be 4 letters, a 0, then 6 letters or digits" },
            allow_blank: true, if: :will_save_change_to_bank_ifsc_code?
  validates :bank_account_number, format: { with: BANK_ACCOUNT_NUMBER, message: "must be 9 to 18 digits" },
            allow_blank: true, if: :will_save_change_to_bank_account_number?
  validates :aadhaar_number, format: { with: AADHAAR_NUMBER, message: "must be exactly 12 digits" },
            allow_blank: true, if: :will_save_change_to_aadhaar_number?
  validates :pan_number, format: { with: PAN_NUMBER, message: "must be 5 letters, 4 digits, then 1 letter" },
            allow_blank: true, if: :will_save_change_to_pan_number?
  validate :profile_photo_is_an_image, if: -> { attachment_changes.key?("profile_photo") }

  # The three numbers that would let somebody impersonate this person or move
  # their money. Encrypted at rest, so a database dump or a stray log line
  # carries ciphertext; who may READ them is EmployeePolicy#view_sensitive_details?.
  # Non-deterministic: nothing ever looks an employee up by these.
  encrypts :bank_account_number
  encrypts :aadhaar_number
  encrypts :pan_number
  # Any further identity documents: a JSON list, encrypted as a whole.
  serialize :other_identity_numbers, coder: JSON, type: Array
  encrypts :other_identity_numbers

  # Typed with spaces, dashes or brackets; stored as digits so two people who
  # entered the same number the same way are stored the same way. Blank
  # entries are a row somebody added and left empty, so they are dropped, as
  # is a number listed twice.
  normalizes :phones, with: ->(list) { Array(list).map { |phone| normalize_phone(phone) }.compact.uniq }
  normalizes :emergency_contacts, with: ->(list) { Array(list).filter_map { |contact| normalize_emergency_contact(contact) } }
  normalizes :other_identity_numbers, with: ->(list) { Array(list).filter_map { |entry| normalize_identity_number(entry) } }
  normalizes :personal_email, with: ->(value) { value.to_s.strip.downcase.presence }
  # Aadhaar is printed in groups of four; the account number is often copied
  # with spaces. Both are stored as their digits.
  normalizes :aadhaar_number, :bank_account_number, with: ->(value) { value.to_s.gsub(/[\s\-]/, "").presence }
  # Case is not significant in either code, so both are stored upper-case and
  # "sbin0001234" is the same branch as "SBIN0001234".
  normalizes :bank_ifsc_code, :pan_number, with: ->(value) { value.to_s.gsub(/\s/, "").upcase.presence }
  normalizes :bank_account_holder_name, with: ->(value) { value.to_s.strip.presence }

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

  # Everyone who reviews this employee's appraisal, level 1 first: the 1st,
  # 2nd and 3rd level managers, then every further level in tier order. Empty
  # levels are skipped and a person is listed once. Snapshotted onto each
  # appraisal when its cycle starts (Appraisal#reviewer_ids).
  def review_chain_ids
    further = manager_assignments_for("additional").sort_by { |a| [ a.tier.to_i, a.id ] }.map(&:manager_id)
    [ primary_manager_id, secondary_manager_id, final_manager_id, *further ].compact.uniq
  end

  # The full §4 hierarchy as the API and the UI talk about it.
  #
  # The three review-chain slots plus the two that sit outside it. Department
  # Head is its own entry and is never derived from the Final Reviewer — §4
  # lists them separately, and an employee's department head must not be
  # treated as their final reviewer.
  def manager_hierarchy
    # Same reasoning as #assigned_manager_id: the list endpoint preloads
    # `manager_assignments: :manager`, but the scoped has_one/has_many
    # associations below are separate caches that preload never fills — so on
    # a page of 25 employees they were six queries per row.
    if manager_assignments.loaded?
      by_level = manager_assignments.group_by(&:manager_level)
      single = ->(level) { by_level[level]&.first&.manager }
      return {
        "primary" => single.call("primary"),
        "secondary" => single.call("secondary"),
        "final" => single.call("final"),
        "department_head" => single.call("department_head"),
        "project_managers" => Array(by_level["project_manager"]).sort_by(&:id).map(&:manager),
        "additional_managers" => Array(by_level["additional"]).sort_by { |a| [ a.tier.to_i, a.id ] }.map(&:manager)
      }
    end

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

  def sync_account_name
    return if user.nil? || (user.first_name == first_name && user.last_name == last_name)

    user.update!(first_name: first_name, last_name: last_name)
  end

  # Identity documents an employee must have on file before submitting a
  # self-appraisal. Key → the name shown to them.
  REQUIRED_IDENTITY_DOCUMENTS = { "aadhaar" => "Aadhaar", "pan" => "PAN" }.freeze

  # Names of the required identity documents with no uploaded file on this
  # employee's profile, e.g. ["Aadhaar", "PAN"]; empty once both are there.
  def missing_identity_documents
    present = documents.where(document_type: REQUIRED_IDENTITY_DOCUMENTS.keys)
                       .joins(:file_attachment).distinct.pluck(:document_type)
    REQUIRED_IDENTITY_DOCUMENTS.except(*present).values
  end

  # The employment fields whose changes are worth a history entry, mapped to
  # the event type each produces. Address and phone are deliberately absent:
  # correcting a typo in a postcode is not an employment event. (An employee
  # changing their OWN details is recorded, but separately and for a different
  # reason — see #record_profile_changes.)
  # The manager levels as the employee form names them, for the history.
  MANAGER_LEVEL_HISTORY_LABELS = {
    "primary" => "1st Level Manager",
    "secondary" => "2nd Level Manager",
    "final" => "3rd Level Manager",
    "project_manager" => "Project Manager(s)",
    "department_head" => "Department Head",
    "additional" => "Additional Manager(s)"
  }.freeze

  TRACKED_EMPLOYMENT_CHANGES = {
    "designation_id" => :designation_changed,
    "department_id" => :department_changed,
    "status" => :status_changed,
    "employment_type_id" => :employment_type_changed,
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

    # Who holds each submitted level now, so only the levels that really change
    # are written to the history — the form sends every level on every save.
    before = submitted.keys.index_with { |level| manager_names_at(level) }

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
    record_manager_change(before)
    refresh_open_appraisal_reviewers
  end

  # An appraisal keeps its reviewer chain from the moment it was created. One
  # that hasn't reached manager review yet takes the new chain instead — a
  # manager set (or changed) after the employee was added to a cycle would
  # otherwise be left out, and the self-appraisal would skip straight past
  # them to the Final review. Appraisals already in review keep the chain they
  # were reviewed under.
  def refresh_open_appraisal_reviewers
    appraisals.where(status: %i[draft self_appraisal_open]).update_all(
      reviewer_ids: review_chain_ids,
      primary_manager_id: primary_manager_id,
      secondary_manager_id: secondary_manager_id,
      final_manager_id: final_manager_id,
      updated_at: Time.current
    )
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

  # What an employee may change about themselves from Profile, labelled the way
  # their History shows it. The same columns EmployeesController::PERSONAL_PARAMS
  # permits on that path (#update_profile) — keep the two in step.
  SELF_EDITABLE_FIELDS = {
    "phones" => "Phone numbers",
    "personal_email" => "Personal email",
    "gender" => "Gender",
    "date_of_birth" => "Date of birth",
    "celebration_date" => "Celebration date",
    "address_line1" => "Street address",
    "address_line2" => "Address line 2",
    "city" => "City",
    "state" => "State",
    "postal_code" => "Postal code",
    "country" => "Country",
    "emergency_contacts" => "Emergency contacts",
    "bank_account_number" => "Bank account number",
    "bank_account_holder_name" => "Account holder name",
    "bank_ifsc_code" => "IFSC code",
    "aadhaar_number" => "Aadhaar number",
    "pan_number" => "PAN number",
    "other_identity_numbers" => "Other identity numbers"
  }.freeze

  # One History entry per field an employee changed about themselves, so Admin
  # and HR can see what was edited, from what, to what, and by whom — the edit
  # itself needs no approval, so this is the oversight.
  #
  # `changes` is the record's saved_changes. Sensitive numbers are logged as
  # "Changed" with no values: the History is read by more people than may read
  # the numbers, and a log is the last place they should be in the clear.
  def record_profile_changes(changes)
    SELF_EDITABLE_FIELDS.each do |attribute, label|
      next unless changes.key?(attribute)

      from, to = changes[attribute]
      sensitive = SENSITIVE_ATTRIBUTES.include?(attribute)
      record_profile_event(
        label,
        sensitive ? nil : readable_profile_value(attribute, from),
        sensitive ? "Changed" : readable_profile_value(attribute, to)
      )
    end
  end

  # The photo isn't a column, so it never shows up in saved_changes.
  def record_profile_photo_change(removed:)
    record_profile_event("Profile photo", nil, removed ? "Removed" : "Updated")
  end

  def self.normalize_phone(value)
    value.to_s.gsub(/[\s()\-]/, "").presence
  end

  # A row with nothing in it is dropped rather than stored as an empty contact.
  # A row an admin or the employee typed: label and number trimmed (the number upper-cased, as these codes are),
  # dropped when both are blank.
  def self.normalize_identity_number(entry)
    entry = entry.to_h.stringify_keys.slice(*OTHER_IDENTITY_NUMBER_KEYS)
    row = { "label" => entry["label"].to_s.squish.presence, "number" => entry["number"].to_s.strip.upcase.presence }
    row.values.any? ? row : nil
  end

  def self.normalize_emergency_contact(contact)
    contact = contact.to_h.stringify_keys.slice(*EMERGENCY_CONTACT_KEYS)
    row = {
      "name" => contact["name"].to_s.strip.presence,
      "relation" => contact["relation"].to_s.strip.presence,
      "phone" => normalize_phone(contact["phone"])
    }
    row.values.any? ? row : nil
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

    def phones_are_valid
      errors.add(:phones, "can't be more than #{MAX_PHONES}") if phones.size > MAX_PHONES
      (phones - Array(attribute_in_database(:phones))).each do |phone|
        errors.add(:phones, "include #{phone}, which isn't a valid Indian mobile number") unless phone.match?(INDIAN_PHONE)
      end
    end

    # A contact needs a name and a number somebody can ring. As with phones,
    # only rows that are new or edited are held to it — a contact carried over
    # from the old single-contact fields may have arrived with only one of the
    # two, and must not block an unrelated save.
    def other_identity_numbers_are_valid
      list = other_identity_numbers || []
      if list.size > MAX_OTHER_IDENTITY_NUMBERS
        errors.add(:other_identity_numbers, "can't be more than #{MAX_OTHER_IDENTITY_NUMBERS}")
      end
      list.each_with_index do |entry, index|
        label = "Identity number #{index + 1}"
        errors.add(:other_identity_numbers, "#{label}: the document name is required") if entry["label"].blank?
        errors.add(:other_identity_numbers, "#{label}: the number is required") if entry["number"].blank?
        errors.add(:other_identity_numbers, "#{label}: the name is too long (at most 50 characters)") if entry["label"].to_s.length > 50
        if entry["number"].present? && !entry["number"].match?(/\A[A-Z0-9][A-Z0-9 \/\-]{0,39}\z/)
          errors.add(:other_identity_numbers, "#{label}: the number may contain only letters, digits, spaces, - and / (at most 40)")
        end
      end
    end

    def emergency_contacts_are_valid
      if emergency_contacts.size > MAX_EMERGENCY_CONTACTS
        errors.add(:emergency_contacts, "can't be more than #{MAX_EMERGENCY_CONTACTS}")
      end

      (emergency_contacts - Array(attribute_in_database(:emergency_contacts))).each do |contact|
        who = contact["name"] || contact["phone"]
        errors.add(:emergency_contacts, "need a name for every contact") if contact["name"].blank?
        if contact["phone"].blank?
          errors.add(:emergency_contacts, "need a phone number for #{who}")
        elsif !contact["phone"].match?(INDIAN_PHONE)
          errors.add(:emergency_contacts, "include #{contact['phone']}, which isn't a valid Indian mobile number")
        end
      end
    end

    def profile_photo_is_an_image
      return unless profile_photo.attached?

      blob = profile_photo.blob
      looks_right = PROFILE_PHOTO_TYPES[blob.content_type]
      head = new_profile_photo_head
      if looks_right.nil? || (head && !looks_right.call(head))
        errors.add(:profile_photo, "must be a PNG, JPG or WebP image")
      end
      errors.add(:profile_photo, "must be 2 MB or smaller") if blob.byte_size > PROFILE_PHOTO_MAX_BYTES
    end

    # The first bytes of a photo being uploaded in this save, or nil when what
    # was attached isn't a readable upload (an existing blob, say).
    def new_profile_photo_head
      attachable = attachment_changes["profile_photo"]&.attachable
      io = attachable.is_a?(Hash) ? attachable[:io] : attachable
      return nil unless io.respond_to?(:read) && io.respond_to?(:rewind)

      io.rewind
      head = io.read(12).to_s.b
      io.rewind
      head
    end

    def record_profile_event(label, from_value, to_value)
      employment_events.create!(
        event_type: :profile_updated,
        note: label,
        from_value: from_value,
        to_value: to_value,
        effective_on: Date.current,
        recorded_by: Current.user
      )
    end

    # Text, like every other History value (§26) — readable without the record.
    def readable_profile_value(attribute, raw)
      case attribute
      when "phones" then Array(raw).join(", ").presence
      when "emergency_contacts"
        Array(raw).map { |c| [ c["name"], c["relation"] && "(#{c['relation']})", c["phone"] ].compact.join(" ") }
                  .join("; ").presence
      when "date_of_birth", "celebration_date" then raw&.strftime("%d %b %Y")
      else raw.presence&.to_s
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

    # One history entry per level whose holder(s) actually changed: who it was
    # (From), who it is now (To), and which level, in the note.
    def record_manager_change(before)
      before.each do |level, from_value|
        to_value = manager_names_at(level)
        next if from_value == to_value

        employment_events.create!(
          event_type: :manager_changed,
          from_value: from_value,
          to_value: to_value,
          note: MANAGER_LEVEL_HISTORY_LABELS.fetch(level.to_s, level.to_s.humanize),
          effective_on: Date.current,
          recorded_by: Current.user
        )
      end
    end

    # The holder(s) of a level as one readable string (nil when empty). The
    # plural slots read as the whole set — "who are the project managers now".
    def manager_names_at(level)
      assigned = public_send(EmployeeManager::ASSOCIATION_FOR_LEVEL.fetch(level.to_s))
      names = assigned.is_a?(Enumerable) ? assigned.map(&:full_name) : [ assigned&.full_name ]
      names.compact.join(", ").presence
    end

    # Names, not ids: an event has to stay readable after the record it points
    # at is renamed or removed (§26).
    def readable_employment_value(attribute, raw)
      return nil if raw.blank?

      case attribute
      when "designation_id" then Designation.find_by(id: raw)&.title
      when "department_id" then Department.find_by(id: raw)&.name
      when "status" then self.class.statuses.key(raw) || raw
      when "employment_type_id" then EmploymentType.find_by(id: raw)&.name
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

  # Why a code breaks the Initial ID rule, or nil when it doesn't.
  #
  # With an Initial ID of "ACM-001", a code must carry the same "ACM-" prefix
  # and a number of at least 1 — "ACM-001" itself is the first valid one. An
  # Initial ID with no trailing number sets no floor.
  def self.employee_code_floor_error(company, code)
    initial = company&.employee_code_initial.to_s.strip
    code = code.to_s.strip
    return nil if initial.blank? || code.blank?

    floor = initial.match(Employees::NextCode::TRAILING_NUMBER)
    return nil if floor.nil?

    prefix, digits = floor.captures
    candidate = code.match(Employees::NextCode::TRAILING_NUMBER)
    return nil if candidate && candidate[1] == prefix && candidate[2].to_i >= digits.to_i

    "must be #{initial} or higher"
  end

  private
    def employee_code_not_below_initial
      message = self.class.employee_code_floor_error(company, employee_code)
      errors.add(:employee_code, message) if message
    end
end

# One change to an employee's employment, kept forever (§3, §26).
#
# Written by Employee callbacks, not by a form — history that depends on
# somebody remembering to record it isn't history. Immutable once written, and
# from/to are stored as TEXT rather than as foreign keys so renaming or
# deleting a designation can never rewrite what someone's title used to be.
class EmployeeEmploymentEvent < ApplicationRecord
  include EmployeeOwned

  enum :event_type, {
    joined: 0, designation_changed: 1, department_changed: 2,
    status_changed: 3, employment_type_changed: 4, manager_changed: 5, location_changed: 6,
    # An employee editing their own profile — one entry per field, the field
    # named in `note` (Employee#record_profile_changes).
    profile_updated: 7
  }, validate: true

  belongs_to :recorded_by, class_name: "User", optional: true

  before_validation { self.effective_on ||= Date.current }

  validates :effective_on, presence: true

  def readonly? = persisted?

  # Who made the change, as a name for the History table. The employee record's
  # name where the login has one, the sign-in address where it doesn't (a bare
  # admin account); nil for entries written by a seed or the console.
  def recorded_by_name
    return nil if recorded_by.nil?

    recorded_by.employee_record&.full_name.presence || recorded_by.email_address
  end

  scope :chronological, -> { order(effective_on: :desc, id: :desc) }
end

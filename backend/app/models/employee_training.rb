# A training action (§20), moving through the scope's own lifecycle:
# Identified → Assigned → Completed → Manager Validated.
class EmployeeTraining < ApplicationRecord
  include EmployeeOwned

  enum :status, { identified: 0, assigned: 1, completed: 2, manager_validated: 3 },
       default: :identified, validate: true

  # Set when the need came out of an appraisal's skill gaps.
  belongs_to :source_appraisal, class_name: "Appraisal", optional: true
  belongs_to :validated_by, class_name: "User", optional: true

  before_validation { self.identified_on ||= Date.current }

  validates :name, presence: true
  validate :completion_needs_a_date

  private
    def completion_needs_a_date
      return if identified? || assigned?
      return if completed_on.present?

      errors.add(:completed_on, "is required once training is completed")
    end
end

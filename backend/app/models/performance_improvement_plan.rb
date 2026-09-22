# A Performance Improvement Plan (§23).
#
# Its own permission key and its own workflow, kept out of the appraisal state
# machine entirely: the scope describes PIP as "a separate,
# permission-controlled workflow", and a PIP can be opened without any appraisal
# being in flight.
class PerformanceImprovementPlan < ApplicationRecord
  include EmployeeOwned

  enum :status, {
    draft: 0, active: 1, review: 2, successfully_completed: 3, extended: 4, closed: 5
  }, default: :draft, validate: true

  belongs_to :opened_by, class_name: "User", optional: true

  validates :issue_description, presence: true
  validate :review_after_start

  private
    def review_after_start
      return if starts_on.blank? || review_on.blank?

      errors.add(:review_on, "can't be before the plan starts") if review_on < starts_on
    end
end

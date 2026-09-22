# Compensation history (§3, §17). Restricted: its own permission key, never
# included in a payload for anyone without it.
#
# Separate from EmployeeEmploymentEvent precisely because the ACCESS differs —
# a manager may reasonably see a designation change and must not see pay.
class EmployeeCompensationRecord < ApplicationRecord
  include EmployeeOwned

  enum :reason, {
    initial: 0, annual_increment: 1, promotion: 2, market_correction: 3, other: 4
  }, prefix: true, default: :initial, validate: true

  # Set when the record came out of an appraisal, so a cycle's outcome and the
  # employee's pay history are one fact rather than two that can disagree.
  belongs_to :appraisal, optional: true
  belongs_to :recorded_by, class_name: "User", optional: true

  validates :effective_on, presence: true
  validates :annual_compensation,
            numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :increment_percentage,
            numericality: { greater_than_or_equal_to: -100, less_than_or_equal_to: 500 }, allow_nil: true

  scope :chronological, -> { order(effective_on: :desc, id: :desc) }
end

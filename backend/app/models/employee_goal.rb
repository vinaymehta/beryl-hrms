# A measurable goal for the next cycle (§19): owner, target date, priority,
# status, success criteria, progress and manager comment.
#
# `source_appraisal` links a goal back to the finalized appraisal that produced
# it, which is what lets the next review surface the previous cycle's goals.
class EmployeeGoal < ApplicationRecord
  include EmployeeOwned

  enum :priority, { low: 0, medium: 1, high: 2 }, prefix: true, default: :medium, validate: true
  enum :status, { not_started: 0, in_progress: 1, achieved: 2, partially_achieved: 3, dropped: 4 },
       default: :not_started, validate: true

  belongs_to :source_appraisal, class_name: "Appraisal", optional: true
  belongs_to :created_by, class_name: "User", optional: true

  validates :title, presence: true, length: { maximum: 255 }

  scope :open, -> { where(status: %i[not_started in_progress]) }
end

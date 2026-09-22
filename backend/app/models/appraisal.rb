# One employee's appraisal within one cycle — the spine of the whole feature.
#
#   Employee → V1 → Primary → V2 → Secondary → V3 → Final → Released → Acked
#
# The record itself holds only CURRENT state. Everything historical lives in
# child records that are never rewritten: revisions, transitions, score
# overrides, comments.
class Appraisal < ApplicationRecord
  acts_as_tenant(:company)

  class WorkflowError < StandardError; end

  # The scope's workflow, in order. `secondary_review` is skipped when the
  # cycle doesn't enable it or the employee has no secondary manager — see
  # #next_review_status.
  enum :status, {
    draft: 0,
    self_appraisal_open: 1,
    employee_submitted: 2,
    primary_review: 3,
    secondary_review: 4,
    final_review: 5,
    appraisal_discussion: 6,
    compensation_approval: 7,
    released: 8,
    employee_acknowledged: 9,
    closed: 10
  }, default: :draft, validate: true

  # Stages at which the employee's own submission is locked. Reopening
  # (Appraisals::Workflow#return_for_correction) moves back out of these.
  LOCKED_FOR_EMPLOYEE = %w[
    employee_submitted primary_review secondary_review final_review
    appraisal_discussion compensation_approval released employee_acknowledged closed
  ].freeze

  belongs_to :company
  belongs_to :appraisal_cycle
  belongs_to :employee
  belongs_to :primary_manager, class_name: "Employee", optional: true
  belongs_to :secondary_manager, class_name: "Employee", optional: true
  belongs_to :final_manager, class_name: "Employee", optional: true
  belongs_to :released_by, class_name: "User", optional: true

  has_many :revisions,
           -> { order(:version_number) },
           class_name: "AppraisalRevision",
           dependent: :destroy,
           inverse_of: :appraisal
  has_many :comments, class_name: "AppraisalComment", dependent: :destroy, inverse_of: :appraisal
  has_many :transitions,
           -> { order(:created_at) },
           class_name: "AppraisalTransition",
           dependent: :destroy,
           inverse_of: :appraisal
  has_many :score_overrides,
           -> { order(:created_at) },
           class_name: "AppraisalScoreOverride",
           dependent: :destroy,
           inverse_of: :appraisal
  # Optional 360° feedback (§21). Nothing waits on these.
  has_many :feedback_requests,
           class_name: "AppraisalFeedbackRequest", dependent: :destroy, inverse_of: :appraisal

  has_one :compensation_decision,
          class_name: "AppraisalCompensationDecision",
          dependent: :destroy,
          inverse_of: :appraisal

  delegate :secondary_review_enabled?, :appraisal_template, to: :appraisal_cycle

  scope :for_reviewer, ->(employee_id) {
    where(primary_manager_id: employee_id)
      .or(where(secondary_manager_id: employee_id))
      .or(where(final_manager_id: employee_id))
  }

  def latest_revision = revisions.last

  def revision_for(stage) = revisions.where(stage: stage).order(:version_number).last

  # V1 by definition: the employee's submitted self-appraisal.
  def self_appraisal_revision = revision_for(:self_appraisal)

  def released? = released_at.present?

  def employee_locked? = LOCKED_FOR_EMPLOYEE.include?(status)

  # Whether this cycle runs a secondary step for THIS employee. Both conditions
  # matter: the cycle has to want one, and somebody has to be in the slot.
  def secondary_review_applicable?
    secondary_review_enabled? && secondary_manager_id.present?
  end

  # The score the workflow actually stands behind: an override when one has been
  # made, otherwise the calculation. Both are always stored.
  def effective_score = final_score || calculated_score

  def overridden? = final_score.present? && calculated_score.present? && final_score != calculated_score

  # Which employee is the reviewer at a given stage.
  def reviewer_id_for(stage)
    case stage.to_s
    when "primary_review" then primary_manager_id
    when "secondary_review" then secondary_manager_id
    when "final_review", "appraisal_discussion", "compensation_approval" then final_manager_id
    end
  end

  # What this employee is to this appraisal, if anything. Drives every reviewer
  # authorization question — see AppraisalPolicy.
  def reviewer_level_for(employee_id)
    return nil if employee_id.blank?

    case employee_id
    when primary_manager_id then "primary"
    when secondary_manager_id then "secondary"
    when final_manager_id then "final"
    end
  end

  # Where the workflow goes after the primary review — the one branch point.
  def next_review_status
    secondary_review_applicable? ? :secondary_review : :final_review
  end
end

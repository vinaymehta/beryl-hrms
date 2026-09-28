# One employee's appraisal within one cycle — the spine of the whole feature.
#
#   Employee (self) → Level 1 manager → Level 2 → … → Level N → Final (Admin/HR)
#     → Discussion → Released → Acknowledged
#
# The manager levels are every level assigned to the employee when the cycle
# started (`reviewer_ids`, level 1 first); empty levels are skipped. They are
# walked one at a time in `manager_review`, with `review_level` saying whose
# turn it is. The Final review after them belongs to Admin/HR, not to a manager.
#
# The record itself holds only CURRENT state. Everything historical lives in
# child records that are never rewritten: revisions, transitions, score
# overrides, comments.
class Appraisal < ApplicationRecord
  acts_as_tenant(:company)

  class WorkflowError < StandardError; end

  # The workflow, in order. `primary_review` and `secondary_review` are the
  # old fixed manager stages, kept only so historical rows still resolve —
  # nothing moves into them any more (LevelBasedAppraisalReview converted the
  # ones in flight). `manager_review` replaces both, once per level.
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
    closed: 10,
    manager_review: 11
  }, default: :draft, validate: true

  # Stages at which the employee's own submission is locked. Reopening
  # (Appraisals::Workflow#return_for_correction) moves back out of these.
  LOCKED_FOR_EMPLOYEE = %w[
    employee_submitted manager_review primary_review secondary_review final_review
    appraisal_discussion compensation_approval released employee_acknowledged closed
  ].freeze

  belongs_to :company
  belongs_to :appraisal_cycle
  belongs_to :employee
  belongs_to :primary_manager, class_name: "Employee", optional: true
  belongs_to :secondary_manager, class_name: "Employee", optional: true
  belongs_to :final_manager, class_name: "Employee", optional: true
  belongs_to :released_by, class_name: "User", optional: true

  # delete_all, not destroy, for the three immutable children.
  #
  # Revisions, transitions and score overrides all answer `readonly? =>
  # persisted?`, which makes `destroy` on them raise ActiveRecord::
  # ReadOnlyRecord — so `dependent: :destroy` made an appraisal, and therefore
  # its whole cycle, impossible to delete. Readonly is there to stop the record
  # being EDITED after the fact, which is a different question from whether the
  # appraisal it belongs to can be removed; when it goes, they go with it.
  #
  # Their own children go too: AppraisalAnswer is readonly for the same reason
  # and hangs off a revision, so it is deleted explicitly below rather than
  # left as a row pointing at nothing.
  has_many :revisions,
           -> { order(:version_number) },
           class_name: "AppraisalRevision",
           dependent: :delete_all,
           inverse_of: :appraisal
  has_many :comments, class_name: "AppraisalComment", dependent: :destroy, inverse_of: :appraisal
  has_many :transitions,
           -> { order(:created_at) },
           class_name: "AppraisalTransition",
           dependent: :delete_all,
           inverse_of: :appraisal
  has_many :score_overrides,
           -> { order(:created_at) },
           class_name: "AppraisalScoreOverride",
           dependent: :delete_all,
           inverse_of: :appraisal

  # Runs before the revisions themselves are deleted, so the answers can still
  # be found by the revisions they belong to.
  before_destroy :delete_revision_answers, prepend: true
  # Optional 360° feedback (§21). Nothing waits on these.
  has_many :feedback_requests,
           class_name: "AppraisalFeedbackRequest", dependent: :destroy, inverse_of: :appraisal

  has_one :compensation_decision,
          class_name: "AppraisalCompensationDecision",
          dependent: :destroy,
          inverse_of: :appraisal

  delegate :appraisal_template, to: :appraisal_cycle

  private
    def delete_revision_answers
      AppraisalAnswer.where(appraisal_revision_id: revisions.select(:id)).delete_all
    end

  public

  # Appraisals this employee reviews at any level.
  scope :for_reviewer, ->(employee_id) { where("? = ANY(appraisals.reviewer_ids)", employee_id) }

  def latest_revision = revisions.last

  def revision_for(stage) = revisions.where(stage: stage).order(:version_number).last

  # V1 by definition: the employee's submitted self-appraisal.
  def self_appraisal_revision = revision_for(:self_appraisal)

  def released? = released_at.present?

  def employee_locked? = LOCKED_FOR_EMPLOYEE.include?(status)

  # The score the workflow actually stands behind: an override when one has been
  # made, otherwise the calculation. Both are always stored.
  def effective_score = final_score || calculated_score

  def overridden? = final_score.present? && calculated_score.present? && final_score != calculated_score

  # The manager reviewing at a given level (1-based), or nil.
  def reviewer_id_at(level)
    level.to_i.positive? ? reviewer_ids[level.to_i - 1] : nil
  end

  # Whose turn it is right now, when a manager level is.
  def current_reviewer_id
    manager_review? ? reviewer_id_at(review_level) : nil
  end

  def current_reviewer = (id = current_reviewer_id) && Employee.find_by(id: id)

  # The level this employee reviews at on this appraisal, or nil.
  def reviewer_level_for(employee_id)
    return nil if employee_id.blank?

    index = reviewer_ids.index(employee_id.to_i)
    index && index + 1
  end

  def reviewers = Employee.where(id: reviewer_ids).index_by(&:id).values_at(*reviewer_ids).compact

  # Where the employee's submission goes: the first manager level, or — with
  # nobody assigned at any level — straight to the Final review.
  def first_review_step
    reviewer_ids.any? ? [ :manager_review, 1 ] : [ :final_review, nil ]
  end

  # Where a manager's submitted review goes: the next level, or the Final
  # review once the last level has reviewed.
  def step_after_manager_review
    review_level.to_i < reviewer_ids.size ? [ :manager_review, review_level.to_i + 1 ] : [ :final_review, nil ]
  end

  # One draft per stage and level, so each manager has their own.
  def review_draft_key
    manager_review? ? "manager_review:#{review_level}" : status
  end
end

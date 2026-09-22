# The increment and promotion outcome of an appraisal (scope §17 and §18).
#
# Increment and promotion are INDEPENDENT here, per §18 — there is no single
# "decision" field forcing them to move together. And within the increment,
# what was recommended is kept separately from what was approved, so a
# reviewer's proposal survives the approval that changed it.
#
# Restricted data throughout: only appraisals.manage_compensation reaches it,
# and Appraisals::DetailPresenter omits the whole block for anyone else.
class AppraisalCompensationDecision < ApplicationRecord
  acts_as_tenant(:company)

  enum :promotion_recommendation,
       { none: 0, recommended: 1, not_recommended: 2, deferred: 3 },
       prefix: :promotion, default: :none, validate: true

  belongs_to :company
  belongs_to :appraisal, inverse_of: :compensation_decision
  belongs_to :actor_user, class_name: "User", optional: true
  belongs_to :current_designation, class_name: "Designation", optional: true
  belongs_to :proposed_designation, class_name: "Designation", optional: true

  before_validation :set_company_from_appraisal
  before_validation :default_current_designation, on: :create

  PERCENTAGE = { greater_than_or_equal_to: -100, less_than_or_equal_to: 500 }.freeze

  validates :recommended_increment_percentage, numericality: PERCENTAGE, allow_nil: true
  validates :approved_increment_percentage, numericality: PERCENTAGE, allow_nil: true
  validate :promotion_carries_a_proposed_designation

  # Whether anything has actually been decided, for the UI's empty state.
  def any_decision?
    [ recommended_increment_percentage, approved_increment_percentage,
      approved_compensation, promotion_reason ].any?(&:present?) || !promotion_none?
  end

  private
    def set_company_from_appraisal
      self.company_id ||= appraisal&.company_id
    end

    # Recorded rather than derived later: the employee's designation at the time
    # the decision was made is the one the promotion is measured from, and it
    # must not shift if their profile changes afterwards.
    def default_current_designation
      self.current_designation_id ||= appraisal&.employee&.designation_id
    end

    def promotion_carries_a_proposed_designation
      return unless promotion_recommended?
      return if proposed_designation_id.present?

      errors.add(:proposed_designation, "is required when a promotion is recommended")
    end
end

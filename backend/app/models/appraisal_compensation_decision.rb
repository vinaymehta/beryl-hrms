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
  # Rupee amounts — income and incentive, before and after. Never negative.
  # current_compensation / approved_compensation are the current and new
  # MONTHLY gross since the letter (the incentive pair is no longer written —
  # incentive is a row of compensation_breakdown now).
  MONEY = { greater_than_or_equal_to: 0 }.freeze

  validates :recommended_increment_percentage, numericality: PERCENTAGE, allow_nil: true
  validates :approved_increment_percentage, numericality: PERCENTAGE, allow_nil: true
  validates :current_compensation, :approved_compensation, :current_incentive, :approved_incentive,
            numericality: MONEY, allow_nil: true
  validate :promotion_carries_a_proposed_designation
  validate :breakdown_is_well_formed
  validate :breakdown_adds_up_to_new_gross
  validate :next_appraisal_after_effective_date

  # Whether anything has actually been decided, for the UI's empty state.
  def any_decision?
    [ recommended_increment_percentage, approved_increment_percentage,
      approved_compensation, approved_incentive, promotion_reason ].any?(&:present?) || !promotion_none?
  end

  # The letter's compensation table: the saved monthly breakdown, every row
  # present (missing rows read as 0).
  def breakdown
    return nil if compensation_breakdown.blank?

    Appraisals::SalaryStructure::KEYS.index_with { |key| compensation_breakdown[key] || 0 }
  end

  # Why this decision can't go out as a letter yet, or nil when it can.
  #
  # A RELEASE check, not a save check: the Discussion form saves as Admin/HR
  # work through it, and a half-filled decision is ordinary until somebody
  # tries to send it to the employee.
  def letter_blocker
    return "Save the decision with an effective date before releasing." if effective_date.blank?
    return "Save the new monthly gross and its breakdown before releasing." if approved_compensation.blank? || breakdown.nil?

    nil
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

    def breakdown_is_well_formed
      return if compensation_breakdown.blank?

      compensation_breakdown.each do |key, value|
        label = Appraisals::SalaryStructure::LABELS[key]
        next errors.add(:base, "#{key} is not a row of the compensation table") if label.nil?

        number = Appraisals::SalaryStructure.numeric(value)
        if number.nil?
          errors.add(:base, "#{label} must be a number")
        elsif number.negative?
          errors.add(:base, "#{label} can't be negative")
        end
      end
    end

    # The letter states the monthly gross AND prints the rows beneath it, so a
    # table that doesn't add up to the figure above it would contradict itself
    # on paper. The EPF rows are not earnings and are left out of the sum.
    def breakdown_adds_up_to_new_gross
      return if compensation_breakdown.blank? || errors.any?

      total = Appraisals::SalaryStructure.monthly_gross(compensation_breakdown)
      gross = approved_compensation || 0
      return if total.round(2) == gross.to_d.round(2)

      format = Appraisals::SalaryStructure.method(:format_amount)
      errors.add(:base, "The breakdown adds up to ₹#{format.call(total)} a month, " \
                        "but the new monthly gross is ₹#{format.call(gross)}.")
    end

    def next_appraisal_after_effective_date
      return if next_appraisal_on.blank? || effective_date.blank?
      return if next_appraisal_on > effective_date

      errors.add(:next_appraisal_on, "must be after the effective date")
    end

    def promotion_carries_a_proposed_designation
      return unless promotion_recommended?
      return if proposed_designation_id.present?

      errors.add(:proposed_designation, "is required when a promotion is recommended")
    end
end

# A configurable run of the appraisal process. Nothing about a particular year
# is baked in — name, period, deadlines and template are all per-cycle data.
class AppraisalCycle < ApplicationRecord
  acts_as_tenant(:company)

  enum :status, { draft: 0, active: 1, closed: 2, cancelled: 3 }, default: :draft, validate: true

  # §22. One attribute, not a second workflow: every review type runs through
  # the same cycle/template/state machine.
  enum :review_type, {
    annual: 0, mid_year: 1, probation: 2, performance_improvement: 3, promotion: 4, ad_hoc: 5
  }, prefix: :review, default: :annual, validate: true

  belongs_to :company
  belongs_to :appraisal_template
  belongs_to :created_by, class_name: "User", optional: true
  has_many :participants,
           class_name: "AppraisalCycleParticipant",
           dependent: :destroy,
           inverse_of: :appraisal_cycle
  has_many :eligible_employees, through: :participants, source: :employee
  has_many :appraisals, dependent: :destroy

  validates :name, presence: true
  validate :period_and_deadlines_in_order
  validate :template_is_usable, on: :create

  # Newest CREATED first, deliberately not by start date. A cycle drafted this
  # morning for next quarter belongs at the top of the list its author is
  # looking at; ordering by starts_on buried it beneath cycles that began
  # earlier but were set up long ago.
  scope :newest_first, -> { order(created_at: :desc, id: :desc) }

  def started? = started_at.present?

  # Progress, for the cycle list and detail header.
  def progress_counts
    appraisals.group(:status).count
  end

  private
    def template_is_usable
      return if appraisal_template.nil?
      return if appraisal_template.active?

      errors.add(:appraisal_template, "must be an active template")
    end

    # Deadlines describe a sequence; one landing before the step it follows is
    # a data-entry slip worth catching here rather than confusing people later.
    def period_and_deadlines_in_order
      if assessment_period_start.present? && assessment_period_end.present? &&
         assessment_period_end < assessment_period_start
        errors.add(:assessment_period_end, "can't be before the start of the assessment period")
      end

      ordered = [
        [ :employee_submission_deadline, employee_submission_deadline ],
        [ :primary_review_deadline, primary_review_deadline ],
        [ :secondary_review_deadline, secondary_review_enabled? ? secondary_review_deadline : nil ],
        [ :finalization_deadline, finalization_deadline ]
      ].reject { |(_, value)| value.nil? }

      ordered.each_cons(2) do |(_, earlier), (later_name, later)|
        errors.add(later_name, "must come after the deadline before it") if later < earlier
      end
    end
end

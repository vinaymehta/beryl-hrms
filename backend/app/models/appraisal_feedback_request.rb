# Optional additional / 360° feedback (§21).
#
# Optional by design: the scope says peer feedback must not be mandatory for
# the initial implementation, so nothing in the appraisal workflow waits on one
# of these — an unanswered request never blocks a transition.
#
# Carries the same two-audience visibility rule as AppraisalComment (§13).
class AppraisalFeedbackRequest < ApplicationRecord
  acts_as_tenant(:company)

  enum :status, { pending: 0, submitted: 1, declined: 2 }, default: :pending, validate: true
  enum :visibility, { employee_visible: 0, management_only: 1 },
       prefix: true, default: :management_only, validate: true

  belongs_to :company
  belongs_to :appraisal
  belongs_to :requested_from, class_name: "Employee"
  belongs_to :requested_by, class_name: "User", optional: true

  before_validation { self.company_id ||= appraisal&.company_id }

  validates :requested_from_id, uniqueness: { scope: :appraisal_id }
  validate :not_the_subject_of_the_appraisal

  scope :newest_first, -> { order(created_at: :desc) }

  def submit!(response)
    update!(response: response, status: :submitted, responded_at: Time.current)
  end

  private
    def not_the_subject_of_the_appraisal
      return if appraisal.nil? || requested_from_id.nil?

      errors.add(:requested_from, "can't be the employee being appraised") if appraisal.employee_id == requested_from_id
    end
end

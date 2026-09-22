# A final reviewer's calibration adjustment. Both numbers are kept, plus a
# mandatory reason — the calculated score is never lost to the override, and
# every override in the chain stays on the record.
class AppraisalScoreOverride < ApplicationRecord
  acts_as_tenant(:company)

  belongs_to :company
  belongs_to :appraisal, inverse_of: :score_overrides
  belongs_to :actor_user, class_name: "User", optional: true

  before_validation :set_company_from_appraisal

  validates :new_score, presence: true,
            numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 5 }
  validates :reason, presence: { message: "is required to override the calculated score" },
            length: { maximum: 2_000 }

  def readonly? = persisted?

  private
    def set_company_from_appraisal
      self.company_id ||= appraisal&.company_id
    end
end

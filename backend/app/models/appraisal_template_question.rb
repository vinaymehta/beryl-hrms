class AppraisalTemplateQuestion < ApplicationRecord
  acts_as_tenant(:company)

  belongs_to :company
  belongs_to :appraisal_template_category, inverse_of: :questions
  has_many :appraisal_answers, dependent: :restrict_with_error

  before_validation :set_company_from_category

  validates :prompt, presence: true

  delegate :appraisal_template, to: :appraisal_template_category

  private
    def set_company_from_category
      self.company_id ||= appraisal_template_category&.company_id
    end
end

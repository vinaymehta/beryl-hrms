class CandidateExperience < ApplicationRecord
  acts_as_tenant(:company)

  belongs_to :company
  belongs_to :candidate

  validates :job_title, :company_name, presence: true
end

class CandidateJobMatch < ApplicationRecord
  acts_as_tenant(:company)

  belongs_to :company
  belongs_to :candidate
  belongs_to :job

  enum :status, {
    suggested: 0,
    shortlisted: 1,
    rejected: 2
  }, default: :suggested

  validates :candidate_id, uniqueness: { scope: %i[company_id job_id] }
end

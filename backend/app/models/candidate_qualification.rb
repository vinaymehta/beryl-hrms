class CandidateQualification < ApplicationRecord
  acts_as_tenant(:company)

  belongs_to :company
  belongs_to :candidate

  validates :degree, presence: true
end

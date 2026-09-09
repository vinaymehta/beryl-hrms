class CandidateCertification < ApplicationRecord
  acts_as_tenant(:company)

  belongs_to :company
  belongs_to :candidate

  validates :name, presence: true
end

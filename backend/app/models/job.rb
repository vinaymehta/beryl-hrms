class Job < ApplicationRecord
  acts_as_tenant(:company)

  belongs_to :company
  belongs_to :department, optional: true
  has_many :candidate_job_matches, dependent: :destroy
  has_many :candidates, through: :candidate_job_matches
  has_many :ai_processing_logs, dependent: :nullify

  enum :status, {
    draft: 0,
    open: 1,
    closed: 2
  }, default: :open

  validates :title, presence: true

  alias_attribute :min_experience, :min_experience_years
end

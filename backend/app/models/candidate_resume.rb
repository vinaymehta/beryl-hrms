class CandidateResume < ApplicationRecord
  acts_as_tenant(:company)

  belongs_to :company
  belongs_to :candidate, optional: true
  belongs_to :duplicate_of, class_name: "CandidateResume", optional: true
  has_many :duplicates, class_name: "CandidateResume", foreign_key: :duplicate_of_id, inverse_of: :duplicate_of, dependent: :nullify
  has_one_attached :file
  has_many :ai_processing_logs, dependent: :nullify

  enum :processing_status, {
    pending: 0,
    processing: 1,
    completed: 2,
    failed: 3,
    not_a_resume: 4,
    duplicate: 5
  }, default: :pending

  validates :file_name, presence: true

  scope :completed, -> { where(processing_status: :completed) }
  scope :pending_or_processing, -> { where(processing_status: %i[pending processing]) }
  scope :failed, -> { where(processing_status: :failed) }

  # Eligibility verdict of the resume ITSELF — a pure function of its own
  # criteria_match_percentage, deliberately never mixed with candidate.status
  # (a person-level field a human can override for reasons outside any one
  # resume). Mixing the two previously caused a real bug: once a candidate
  # was shortlisted via one strong resume, EVERY other resume they ever
  # submitted — including 0%-match ones — fell through to neither
  # "shortlisted" nor "rejected", silently vanishing into a hidden bucket
  # that didn't reconcile with Total Resumes. These three now strictly
  # partition every resume by whether it has been evaluated:
  #   - nil match%   -> not yet evaluated (still pending/processing, or
  #                     failed before evaluation ran) -> needs_review
  #   - 100% match   -> shortlisted
  #   - 0-99% match  -> rejected (evaluated, didn't confirm all 4 criteria)
  scope :eligibility_shortlisted, -> { where(criteria_match_percentage: 100) }
  scope :eligibility_rejected, -> { where.not(criteria_match_percentage: [nil, 100]) }
  scope :eligibility_needs_review, -> { where(criteria_match_percentage: nil) }

  def self.by_eligibility(status)
    case status.to_s
    when "shortlisted" then eligibility_shortlisted
    when "rejected" then eligibility_rejected
    when "needs_review" then eligibility_needs_review
    else all
    end
  end

  def source
    source_email_id.present? ? "zoho_mail" : "manual_upload"
  end

  def source=(val)
    # virtual attribute for compatibility
  end
end

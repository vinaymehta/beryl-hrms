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

  def source
    source_email_id.present? ? "zoho_mail" : "manual_upload"
  end

  def source=(val)
    # virtual attribute for compatibility
  end
end

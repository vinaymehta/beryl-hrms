# One application sent from the careers website for a JobOpening — see
# JobApplications::Submit, which creates it together with its resume.
#
# The applicant's own name, email and phone are kept here as typed: they are
# more reliable than what the AI reads off the resume, so ResumeExtractionJob
# uses them for the candidate. candidate is empty until that job has run.
class JobApplication < ApplicationRecord
  acts_as_tenant(:company)

  # The same email may apply to the same opening again only after this long.
  REAPPLY_AFTER = 30.days

  belongs_to :company
  belongs_to :job_opening, optional: true
  belongs_to :candidate, optional: true
  belongs_to :candidate_resume

  normalizes :email, with: ->(email) { email.strip.downcase }
  normalizes :name, :phone, with: ->(value) { value.strip.squeeze(" ") }

  validates :name, :email, :phone, presence: true

  # An application from this address to this opening that still blocks
  # another one.
  def self.recent_from?(email, job_opening)
    where(job_opening: job_opening, email: normalize_value_for(:email, email.to_s))
      .exists?(created_at: REAPPLY_AFTER.ago..)
  end

  # first and last name for a candidate created from this application. A
  # single word is a first name only; middle names are left out.
  def name_parts
    words = name.split
    { first_name: words.first, last_name: (words.last if words.size > 1) }
  end
end

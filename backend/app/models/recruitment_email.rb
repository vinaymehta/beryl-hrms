# One recruitment email the app sent about a candidate (see the
# create_recruitment_emails migration for why these are logged at all).
# Written only by RecruitmentEmailLogging; read by the resume panel's Emails
# tab alongside the candidate's Zoho conversation.
class RecruitmentEmail < ApplicationRecord
  acts_as_tenant(:company)

  belongs_to :company
  # Empty only while the resume it was sent about has no candidate yet (see
  # RecruitmentEmailLogging).
  belongs_to :candidate, optional: true
  belongs_to :candidate_resume, optional: true

  validates :mailer, :mailer_action, :sent_at, presence: true
end

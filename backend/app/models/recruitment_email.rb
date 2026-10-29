# One recruitment email the app sent about a candidate (see the
# create_recruitment_emails migration for why these are logged at all).
# Written only by RecruitmentEmailLogging; read by the resume panel's Emails
# tab alongside the candidate's Zoho conversation.
class RecruitmentEmail < ApplicationRecord
  acts_as_tenant(:company)

  belongs_to :company
  belongs_to :candidate
  belongs_to :candidate_resume, optional: true

  validates :mailer, :mailer_action, :sent_at, presence: true
end

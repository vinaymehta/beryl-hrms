# Recruitment mail the APP itself sent about a candidate — the booking link to
# the candidate, the interview packet and feedback request to the interviewer.
# These go out through ActionMailer (Resend/SMTP), not through any connected
# Zoho mailbox, so without this log they would be missing from the candidate's
# email timeline entirely. Written by RecruitmentEmailLogging after a
# successful delivery; never edited afterwards.
#
# Only the plain-text part is kept, and attachments only by name: the timeline
# needs to show what was said, not to resend it.
class CreateRecruitmentEmails < ActiveRecord::Migration[8.1]
  def change
    create_table :recruitment_emails do |t|
      # Covered by the (company_id, candidate_id, sent_at) index below.
      t.references :company, null: false, foreign_key: true, index: false
      t.references :candidate, null: false, foreign_key: { on_delete: :cascade }
      # The resume that was current when the mail went out — informational
      # only, so deleting that resume keeps the record.
      t.references :candidate_resume, foreign_key: { on_delete: :nullify }
      t.string :direction, null: false, default: "outbound"
      # e.g. "InterviewerMailer" + "interview_booked".
      t.string :mailer, null: false
      t.string :mailer_action, null: false
      t.string :to_address
      t.string :from_address
      t.string :subject
      t.text :body_text
      t.string :attachment_names, array: true, null: false, default: []
      t.string :message_id
      t.datetime :sent_at, null: false
      t.timestamps
    end
    add_index :recruitment_emails, %i[company_id candidate_id sent_at]
  end
end

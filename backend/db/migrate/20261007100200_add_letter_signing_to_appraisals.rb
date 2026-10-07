# The appraisal letter and the employee's signature on it.
#
# The PDFs and the signature image are Active Storage attachments
# (Appraisal#letter_pdf, #signed_letter_pdf, #employee_signature), so they need
# no columns. What is stored here is the audit record of the signing: which
# letter was signed (the SHA-256 of the unsigned PDF), when, from where, by
# what name, and whether the signature was drawn or uploaded.
#
# acknowledged_at stays the "done" marker — signing sets it — so everything
# that already reads it (the list, the timeline, Close) keeps working.
class AddLetterSigningToAppraisals < ActiveRecord::Migration[8.1]
  def change
    add_column :appraisals, :letter_sha256, :string
    add_column :appraisals, :signed_at, :datetime
    add_column :appraisals, :signed_ip, :string
    add_column :appraisals, :signed_user_agent, :string
    add_column :appraisals, :signed_name, :string
    add_column :appraisals, :signature_method, :string
  end
end

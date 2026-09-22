# A draft is NOT a version.
#
# Until now "save draft" went through submit_self, which creates an
# AppraisalRevision — and revisions are immutable and numbered, so every save
# minted another V-number. With a step-by-step self-appraisal saving at each
# step that would bury the real history the Final Reviewer has to read, and it
# already had a sharper edge: the manager's read-only reference is the FIRST
# self_appraisal revision, so a stale half-finished draft was what they
# reviewed against rather than what the employee actually submitted.
#
# So work-in-progress lives here, on the appraisal, mutable and unversioned,
# and a revision is created only when the employee actually submits.
class AddSelfAppraisalDraftToAppraisals < ActiveRecord::Migration[8.1]
  def change
    add_column :appraisals, :self_appraisal_draft, :jsonb, null: false, default: {}
    add_column :appraisals, :self_appraisal_draft_saved_at, :datetime
  end
end

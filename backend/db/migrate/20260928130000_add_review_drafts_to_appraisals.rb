# A reviewer's work in progress, kept per review stage — the counterpart of
# self_appraisal_draft for the employee. Keyed by the stage it was written at
# ("primary_review", …), each entry carrying its author, so one manager's
# unsubmitted draft is never handed to another, and the employee never sees
# any of them.
class AddReviewDraftsToAppraisals < ActiveRecord::Migration[8.1]
  def change
    add_column :appraisals, :review_drafts, :jsonb, null: false, default: {}
  end
end

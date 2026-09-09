class AddDuplicateTrackingToCandidateResumes < ActiveRecord::Migration[8.1]
  def change
    add_column :candidate_resumes, :duplicate_of_id, :bigint
    add_column :candidate_resumes, :is_current, :boolean, default: true, null: false

    add_index :candidate_resumes, :duplicate_of_id
    add_foreign_key :candidate_resumes, :candidate_resumes, column: :duplicate_of_id
  end
end

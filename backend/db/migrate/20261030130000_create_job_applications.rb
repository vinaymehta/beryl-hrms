# Applications sent from the careers website (POST
# /api/v1/public/job_openings/:slug/applications). Each one brings a resume
# into the normal Recruitment pipeline and records which opening it was for.
#
# Tenanted like candidates and resumes, even though job_openings isn't: the
# applicant becomes a candidate of one company (CAREERS_COMPANY_ID), and the
# application belongs with that candidate.
#
# candidate_id stays empty until ResumeExtractionJob has worked out who sent
# the resume. Deleting the resume deletes the application with it; deleting
# the opening only unlinks it.
#
# recruitment_emails.candidate_id loses its NOT NULL: the "application
# received" mail goes out straight away, usually before extraction has found
# the candidate, so it is logged against the resume and filled in later.
class CreateJobApplications < ActiveRecord::Migration[8.1]
  def change
    create_table :job_applications do |t|
      t.references :company, null: false, foreign_key: true
      t.integer :job_opening_id
      t.references :candidate, foreign_key: { on_delete: :nullify }
      t.references :candidate_resume, null: false, index: { unique: true }, foreign_key: { on_delete: :cascade }
      t.string :name, null: false
      t.string :email, null: false
      t.string :phone, null: false
      t.text :role_answer
      t.string :portfolio_url
      t.string :source_ip
      t.timestamps
    end

    add_foreign_key :job_applications, :job_openings, on_delete: :nullify
    add_index :job_applications, %i[job_opening_id created_at]
    add_index :job_applications, :email

    change_column_null :recruitment_emails, :candidate_id, true
  end
end

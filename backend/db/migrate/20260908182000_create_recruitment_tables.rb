class CreateRecruitmentTables < ActiveRecord::Migration[8.1]
  def change
    create_table :candidates do |t|
      t.references :company, null: false, foreign_key: true
      t.string :first_name
      t.string :last_name
      t.string :full_name
      t.string :email
      t.string :phone
      t.string :city
      t.string :state
      t.string :country
      t.string :current_location
      t.string :preferred_location
      t.string :current_role
      t.string :highest_qualification
      t.decimal :experience_years, precision: 4, scale: 1, default: 0.0, null: false
      t.string :notice_period
      t.integer :status, default: 0, null: false # needs_review: 0, applied: 1, screening: 2, interviewing: 3, shortlisted: 4, offered: 5, rejected: 6
      t.string :source, default: "manual_upload", null: false
      t.integer :duplicate_status, default: 0, null: false # unique: 0, potential_duplicate: 1, confirmed_duplicate: 2
      t.text :notes
      t.jsonb :tags, default: []

      t.timestamps
    end

    add_index :candidates, %i[company_id status]
    add_index :candidates, %i[company_id email]
    add_index :candidates, %i[company_id phone]
    add_index :candidates, %i[company_id city]
    add_index :candidates, %i[company_id experience_years]

    create_table :candidate_resumes do |t|
      t.references :company, null: false, foreign_key: true
      t.references :candidate, null: true, foreign_key: true # Nullable: resumes can be ingested before a Candidate profile is resolved
      t.string :file_name, null: false
      t.bigint :file_size
      t.string :content_type
      t.string :file_hash
      t.string :source_email_id
      t.string :source_attachment_id
      t.integer :processing_status, default: 0, null: false # pending: 0, processing: 1, completed: 2, failed: 3, not_a_resume: 4
      t.text :raw_text
      t.jsonb :extracted_data, default: {}
      t.jsonb :provenance_data, default: {}
      t.jsonb :ai_metadata, default: {}
      t.text :error_message
      t.integer :retries_count, default: 0, null: false
      t.datetime :processed_at

      t.timestamps
    end

    add_index :candidate_resumes, %i[company_id processing_status]
    add_index :candidate_resumes, %i[company_id file_hash]

    create_table :candidate_skills do |t|
      t.references :company, null: false, foreign_key: true
      t.references :candidate, null: false, foreign_key: true
      t.string :name, null: false
      t.string :category
      t.float :confidence, default: 1.0, null: false
      t.string :provenance, default: "explicit"

      t.timestamps
    end

    add_index :candidate_skills, %i[company_id name]
    add_index :candidate_skills, %i[company_id candidate_id]

    create_table :candidate_qualifications do |t|
      t.references :company, null: false, foreign_key: true
      t.references :candidate, null: false, foreign_key: true
      t.string :degree, null: false
      t.string :field_of_study
      t.string :institution
      t.integer :year_completed
      t.float :confidence, default: 1.0, null: false
      t.string :provenance, default: "explicit"

      t.timestamps
    end

    add_index :candidate_qualifications, %i[company_id degree]
    add_index :candidate_qualifications, %i[company_id candidate_id]

    create_table :candidate_experiences do |t|
      t.references :company, null: false, foreign_key: true
      t.references :candidate, null: false, foreign_key: true
      t.string :job_title, null: false
      t.string :company_name, null: false
      t.date :start_date
      t.date :end_date
      t.boolean :is_current, default: false, null: false
      t.integer :duration_months
      t.text :description
      t.float :confidence, default: 1.0, null: false

      t.timestamps
    end

    add_index :candidate_experiences, %i[company_id candidate_id]

    create_table :candidate_certifications do |t|
      t.references :company, null: false, foreign_key: true
      t.references :candidate, null: false, foreign_key: true
      t.string :name, null: false
      t.string :issuing_organization
      t.date :issue_date

      t.timestamps
    end

    add_index :candidate_certifications, %i[company_id candidate_id]

    create_table :jobs do |t|
      t.references :company, null: false, foreign_key: true
      t.references :department, null: true, foreign_key: true
      t.string :title, null: false
      t.string :location
      t.decimal :min_experience_years, precision: 4, scale: 1, default: 0.0, null: false
      t.jsonb :required_qualifications, default: []
      t.jsonb :required_skills, default: []
      t.text :description
      t.integer :status, default: 0, null: false # draft: 0, open: 1, closed: 2

      t.timestamps
    end

    add_index :jobs, %i[company_id status]

    create_table :candidate_job_matches do |t|
      t.references :company, null: false, foreign_key: true
      t.references :candidate, null: false, foreign_key: true
      t.references :job, null: false, foreign_key: true
      t.integer :match_score, default: 0, null: false
      t.integer :skills_score, default: 0, null: false
      t.integer :experience_score, default: 0, null: false
      t.integer :qualification_score, default: 0, null: false
      t.jsonb :strong_matches, default: []
      t.jsonb :potential_gaps, default: []
      t.jsonb :matching_skills, default: []
      t.jsonb :missing_skills, default: []
      t.text :ai_explanation
      t.jsonb :ai_metadata, default: {}
      t.integer :status, default: 0, null: false # suggested: 0, shortlisted: 1, rejected: 2
      t.datetime :evaluated_at

      t.timestamps
    end

    add_index :candidate_job_matches, %i[company_id candidate_id job_id], unique: true, name: "index_candidate_job_matches_uniqueness"
    add_index :candidate_job_matches, %i[company_id job_id match_score]
  end
end

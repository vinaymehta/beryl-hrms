class EnhanceRecruitmentDataModel < ActiveRecord::Migration[8.1]
  def change
    # Structured extraction fields present in the AI schema but not yet modeled (spec: industry/domain, spoken languages)
    add_column :candidates, :industry, :string
    add_column :candidates, :languages, :jsonb, default: [], null: false

    # Provenance/confidence coverage was inconsistent across child records — bring
    # experiences and certifications in line with skills/qualifications.
    add_column :candidate_experiences, :provenance, :string, default: "explicit"
    add_column :candidate_certifications, :confidence, :float, default: 1.0, null: false
    add_column :candidate_certifications, :provenance, :string, default: "explicit"

    add_index :candidates, %i[company_id duplicate_status]

    # Dedicated, append-only AI-call audit trail (provider/model/prompt version/
    # duration/status per call) — previously only captured transiently and
    # overwritten on reprocess inside candidate_resumes.ai_metadata.
    create_table :ai_processing_logs do |t|
      t.references :company, null: false, foreign_key: true
      t.references :candidate_resume, null: true, foreign_key: true
      t.references :candidate, null: true, foreign_key: true
      t.references :job, null: true, foreign_key: true
      t.string :operation, null: false # resume_parse, candidate_match, search_parse, dashboard_insights
      t.string :provider
      t.string :model
      t.string :prompt_version
      t.string :status, null: false # success, failed
      t.integer :duration_ms
      t.text :error_message

      t.datetime :created_at, null: false
    end

    add_index :ai_processing_logs, %i[company_id operation]
    add_index :ai_processing_logs, %i[company_id created_at]
  end
end

# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_09_25_200000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "active_storage_attachments", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.bigint "record_id", null: false
    t.string "record_type", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.string "content_type"
    t.datetime "created_at", null: false
    t.string "filename", null: false
    t.string "key", null: false
    t.text "metadata"
    t.string "service_name", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "ai_processing_logs", force: :cascade do |t|
    t.bigint "candidate_id"
    t.bigint "candidate_resume_id"
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.integer "duration_ms"
    t.text "error_message"
    t.bigint "job_id"
    t.string "model"
    t.string "operation", null: false
    t.string "prompt_version"
    t.string "provider"
    t.string "status", null: false
    t.index ["candidate_id"], name: "index_ai_processing_logs_on_candidate_id"
    t.index ["candidate_resume_id"], name: "index_ai_processing_logs_on_candidate_resume_id"
    t.index ["company_id", "created_at"], name: "index_ai_processing_logs_on_company_id_and_created_at"
    t.index ["company_id", "operation"], name: "index_ai_processing_logs_on_company_id_and_operation"
    t.index ["company_id"], name: "index_ai_processing_logs_on_company_id"
    t.index ["job_id"], name: "index_ai_processing_logs_on_job_id"
  end

  create_table "appraisal_answers", force: :cascade do |t|
    t.bigint "appraisal_revision_id", null: false
    t.bigint "appraisal_template_question_id", null: false
    t.text "comment"
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.integer "rating"
    t.datetime "updated_at", null: false
    t.index ["appraisal_revision_id", "appraisal_template_question_id"], name: "index_appraisal_answers_uniqueness", unique: true
    t.index ["appraisal_revision_id"], name: "index_appraisal_answers_on_revision"
    t.index ["appraisal_template_question_id"], name: "index_appraisal_answers_on_question"
    t.index ["company_id"], name: "index_appraisal_answers_on_company_id"
  end

  create_table "appraisal_comments", force: :cascade do |t|
    t.bigint "appraisal_id", null: false
    t.bigint "appraisal_revision_id"
    t.bigint "author_user_id", null: false
    t.text "body", null: false
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "visibility", default: 1, null: false
    t.index ["appraisal_id", "visibility"], name: "index_appraisal_comments_on_appraisal_id_and_visibility"
    t.index ["appraisal_id"], name: "index_appraisal_comments_on_appraisal_id"
    t.index ["appraisal_revision_id"], name: "index_appraisal_comments_on_revision"
    t.index ["author_user_id"], name: "index_appraisal_comments_on_author_user_id"
    t.index ["company_id"], name: "index_appraisal_comments_on_company_id"
  end

  create_table "appraisal_compensation_decisions", force: :cascade do |t|
    t.bigint "actor_user_id"
    t.bigint "appraisal_id", null: false
    t.decimal "approved_compensation", precision: 12, scale: 2
    t.decimal "approved_increment_percentage", precision: 5, scale: 2
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.decimal "current_compensation", precision: 12, scale: 2
    t.bigint "current_designation_id"
    t.date "effective_date"
    t.date "last_increment_on"
    t.decimal "last_increment_percentage", precision: 5, scale: 2
    t.text "management_comments"
    t.text "new_responsibilities"
    t.date "promotion_effective_date"
    t.text "promotion_reason"
    t.integer "promotion_recommendation", default: 0, null: false
    t.bigint "proposed_designation_id"
    t.decimal "recommended_compensation", precision: 12, scale: 2
    t.decimal "recommended_increment_percentage", precision: 5, scale: 2
    t.datetime "updated_at", null: false
    t.index ["actor_user_id"], name: "index_appraisal_compensation_decisions_on_actor_user_id"
    t.index ["appraisal_id"], name: "index_appraisal_compensation_decisions_on_appraisal_id", unique: true
    t.index ["company_id"], name: "index_appraisal_compensation_decisions_on_company_id"
    t.index ["current_designation_id"], name: "idx_on_current_designation_id_62ccb4d005"
    t.index ["proposed_designation_id"], name: "idx_on_proposed_designation_id_d62dc8ae26"
  end

  create_table "appraisal_cycle_participants", force: :cascade do |t|
    t.bigint "appraisal_cycle_id", null: false
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.bigint "employee_id", null: false
    t.datetime "updated_at", null: false
    t.index ["appraisal_cycle_id", "employee_id"], name: "index_appraisal_participants_uniqueness", unique: true
    t.index ["appraisal_cycle_id"], name: "index_appraisal_cycle_participants_on_appraisal_cycle_id"
    t.index ["company_id"], name: "index_appraisal_cycle_participants_on_company_id"
    t.index ["employee_id"], name: "index_appraisal_cycle_participants_on_employee_id"
  end

  create_table "appraisal_cycles", force: :cascade do |t|
    t.bigint "appraisal_template_id", null: false
    t.date "assessment_period_end"
    t.date "assessment_period_start"
    t.datetime "closed_at"
    t.bigint "company_id", null: false
    t.date "compensation_effective_date"
    t.datetime "created_at", null: false
    t.bigint "created_by_id"
    t.text "description"
    t.date "employee_submission_deadline"
    t.date "finalization_deadline"
    t.string "name", null: false
    t.date "primary_review_deadline"
    t.integer "review_type", default: 0, null: false
    t.date "secondary_review_deadline"
    t.boolean "secondary_review_enabled", default: false, null: false
    t.datetime "started_at"
    t.date "starts_on"
    t.integer "status", default: 0, null: false
    t.datetime "updated_at", null: false
    t.index ["appraisal_template_id"], name: "index_appraisal_cycles_on_appraisal_template_id"
    t.index ["company_id", "review_type"], name: "index_appraisal_cycles_on_company_id_and_review_type"
    t.index ["company_id", "status"], name: "index_appraisal_cycles_on_company_id_and_status"
    t.index ["company_id"], name: "index_appraisal_cycles_on_company_id"
    t.index ["created_by_id"], name: "index_appraisal_cycles_on_created_by_id"
  end

  create_table "appraisal_feedback_requests", force: :cascade do |t|
    t.bigint "appraisal_id", null: false
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.text "prompt"
    t.bigint "requested_by_id"
    t.bigint "requested_from_id", null: false
    t.datetime "responded_at"
    t.text "response"
    t.integer "status", default: 0, null: false
    t.datetime "updated_at", null: false
    t.integer "visibility", default: 1, null: false
    t.index ["appraisal_id", "requested_from_id"], name: "index_feedback_requests_uniqueness", unique: true
    t.index ["appraisal_id"], name: "index_appraisal_feedback_requests_on_appraisal_id"
    t.index ["company_id"], name: "index_appraisal_feedback_requests_on_company_id"
    t.index ["requested_by_id"], name: "index_appraisal_feedback_requests_on_requested_by_id"
    t.index ["requested_from_id"], name: "index_appraisal_feedback_requests_on_requested_from_id"
  end

  create_table "appraisal_revisions", force: :cascade do |t|
    t.text "achievements"
    t.bigint "appraisal_id", null: false
    t.bigint "author_employee_id"
    t.bigint "author_user_id"
    t.decimal "calculated_score", precision: 6, scale: 2
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.text "improvement_areas"
    t.text "next_period_goals"
    t.jsonb "responses", default: {}, null: false
    t.integer "stage", null: false
    t.text "strengths"
    t.datetime "submitted_at", null: false
    t.text "summary"
    t.text "training_needs"
    t.datetime "updated_at", null: false
    t.integer "version_number", null: false
    t.index ["appraisal_id", "stage"], name: "index_appraisal_revisions_on_appraisal_id_and_stage"
    t.index ["appraisal_id", "version_number"], name: "index_appraisal_revisions_uniqueness", unique: true
    t.index ["appraisal_id"], name: "index_appraisal_revisions_on_appraisal_id"
    t.index ["author_employee_id"], name: "index_appraisal_revisions_on_author_employee_id"
    t.index ["author_user_id"], name: "index_appraisal_revisions_on_author_user_id"
    t.index ["company_id"], name: "index_appraisal_revisions_on_company_id"
  end

  create_table "appraisal_score_overrides", force: :cascade do |t|
    t.bigint "actor_user_id"
    t.bigint "appraisal_id", null: false
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.decimal "new_score", precision: 6, scale: 2, null: false
    t.decimal "previous_score", precision: 6, scale: 2
    t.text "reason", null: false
    t.datetime "updated_at", null: false
    t.index ["actor_user_id"], name: "index_appraisal_score_overrides_on_actor_user_id"
    t.index ["appraisal_id"], name: "index_appraisal_score_overrides_on_appraisal_id"
    t.index ["company_id"], name: "index_appraisal_score_overrides_on_company_id"
  end

  create_table "appraisal_template_categories", force: :cascade do |t|
    t.bigint "appraisal_template_id", null: false
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.text "description"
    t.integer "lens"
    t.string "name", null: false
    t.integer "position", default: 0, null: false
    t.datetime "updated_at", null: false
    t.decimal "weight", precision: 5, scale: 2, default: "0.0", null: false
    t.index ["appraisal_template_id", "position"], name: "index_appraisal_categories_on_template_and_position"
    t.index ["appraisal_template_id"], name: "index_appraisal_template_categories_on_appraisal_template_id"
    t.index ["company_id"], name: "index_appraisal_template_categories_on_company_id"
  end

  create_table "appraisal_template_questions", force: :cascade do |t|
    t.bigint "appraisal_template_category_id", null: false
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.text "description"
    t.boolean "manager_rating", default: true, null: false
    t.integer "position", default: 0, null: false
    t.string "prompt", null: false
    t.boolean "required", default: true, null: false
    t.boolean "requires_comment", default: false, null: false
    t.boolean "self_rating", default: true, null: false
    t.datetime "updated_at", null: false
    t.index ["appraisal_template_category_id"], name: "index_appraisal_questions_on_category"
    t.index ["company_id"], name: "index_appraisal_template_questions_on_company_id"
  end

  create_table "appraisal_templates", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.bigint "created_by_id"
    t.text "description"
    t.bigint "lineage_id"
    t.string "name", null: false
    t.integer "status", default: 0, null: false
    t.jsonb "structure", default: {}, null: false
    t.datetime "updated_at", null: false
    t.integer "version", default: 1, null: false
    t.index ["company_id", "lineage_id", "version"], name: "index_appraisal_templates_on_lineage_version", unique: true
    t.index ["company_id", "status"], name: "index_appraisal_templates_on_company_id_and_status"
    t.index ["company_id"], name: "index_appraisal_templates_on_company_id"
    t.index ["created_by_id"], name: "index_appraisal_templates_on_created_by_id"
  end

  create_table "appraisal_transitions", force: :cascade do |t|
    t.bigint "actor_user_id"
    t.bigint "appraisal_id", null: false
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.integer "from_status"
    t.text "notes"
    t.integer "to_status", null: false
    t.datetime "updated_at", null: false
    t.index ["actor_user_id"], name: "index_appraisal_transitions_on_actor_user_id"
    t.index ["appraisal_id", "created_at"], name: "index_appraisal_transitions_on_appraisal_id_and_created_at"
    t.index ["appraisal_id"], name: "index_appraisal_transitions_on_appraisal_id"
    t.index ["company_id"], name: "index_appraisal_transitions_on_company_id"
  end

  create_table "appraisals", force: :cascade do |t|
    t.datetime "acknowledged_at"
    t.text "acknowledgement_note"
    t.bigint "appraisal_cycle_id", null: false
    t.decimal "calculated_score", precision: 6, scale: 2
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.bigint "employee_id", null: false
    t.bigint "final_manager_id"
    t.decimal "final_score", precision: 6, scale: 2
    t.bigint "primary_manager_id"
    t.datetime "released_at"
    t.bigint "released_by_id"
    t.bigint "secondary_manager_id"
    t.jsonb "self_appraisal_draft", default: {}, null: false
    t.datetime "self_appraisal_draft_saved_at"
    t.integer "status", default: 0, null: false
    t.datetime "updated_at", null: false
    t.index ["appraisal_cycle_id", "employee_id"], name: "index_appraisals_uniqueness", unique: true
    t.index ["appraisal_cycle_id"], name: "index_appraisals_on_appraisal_cycle_id"
    t.index ["company_id", "final_manager_id"], name: "index_appraisals_on_company_id_and_final_manager_id"
    t.index ["company_id", "primary_manager_id"], name: "index_appraisals_on_company_id_and_primary_manager_id"
    t.index ["company_id", "secondary_manager_id"], name: "index_appraisals_on_company_id_and_secondary_manager_id"
    t.index ["company_id", "status"], name: "index_appraisals_on_company_id_and_status"
    t.index ["company_id"], name: "index_appraisals_on_company_id"
    t.index ["employee_id"], name: "index_appraisals_on_employee_id"
    t.index ["released_by_id"], name: "index_appraisals_on_released_by_id"
  end

  create_table "attendance_records", force: :cascade do |t|
    t.datetime "check_in_at"
    t.datetime "check_out_at"
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.date "date"
    t.bigint "employee_id", null: false
    t.text "notes"
    t.integer "status", default: 0, null: false
    t.datetime "updated_at", null: false
    t.index ["company_id", "date"], name: "index_attendance_records_on_company_id_and_date"
    t.index ["company_id"], name: "index_attendance_records_on_company_id"
    t.index ["employee_id", "date"], name: "index_attendance_records_on_employee_id_and_date", unique: true
    t.index ["employee_id"], name: "index_attendance_records_on_employee_id"
  end

  create_table "audit_logs", force: :cascade do |t|
    t.string "action", null: false
    t.bigint "actor_id"
    t.jsonb "after_changes"
    t.bigint "auditable_id"
    t.string "auditable_type"
    t.jsonb "before_changes"
    t.bigint "company_id"
    t.datetime "created_at", null: false
    t.string "ip_address"
    t.string "user_agent"
    t.index ["actor_id"], name: "index_audit_logs_on_actor_id"
    t.index ["company_id", "auditable_type", "auditable_id"], name: "index_audit_logs_on_company_and_auditable"
    t.index ["company_id", "created_at"], name: "index_audit_logs_on_company_id_and_created_at"
    t.index ["company_id"], name: "index_audit_logs_on_company_id"
  end

  create_table "calendly_connections", force: :cascade do |t|
    t.text "access_token"
    t.string "calendly_user_uri"
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.string "default_event_type_uri"
    t.string "email_address"
    t.string "organization_uri"
    t.text "refresh_token"
    t.integer "status", default: 0, null: false
    t.datetime "token_expires_at"
    t.datetime "updated_at", null: false
    t.bigint "user_id"
    t.string "webhook_subscription_uri"
    t.index ["company_id", "status"], name: "index_calendly_connections_on_company_id_and_status"
    t.index ["company_id"], name: "index_calendly_connections_on_company_id"
    t.index ["user_id"], name: "index_calendly_connections_on_user_id"
  end

  create_table "candidate_certifications", force: :cascade do |t|
    t.bigint "candidate_id", null: false
    t.bigint "company_id", null: false
    t.float "confidence", default: 1.0, null: false
    t.datetime "created_at", null: false
    t.date "issue_date"
    t.string "issuing_organization"
    t.string "name", null: false
    t.string "provenance", default: "explicit"
    t.datetime "updated_at", null: false
    t.index ["candidate_id"], name: "index_candidate_certifications_on_candidate_id"
    t.index ["company_id", "candidate_id"], name: "index_candidate_certifications_on_company_id_and_candidate_id"
    t.index ["company_id"], name: "index_candidate_certifications_on_company_id"
  end

  create_table "candidate_experiences", force: :cascade do |t|
    t.bigint "candidate_id", null: false
    t.bigint "company_id", null: false
    t.string "company_name", null: false
    t.float "confidence", default: 1.0, null: false
    t.datetime "created_at", null: false
    t.text "description"
    t.integer "duration_months"
    t.date "end_date"
    t.boolean "is_current", default: false, null: false
    t.string "job_title", null: false
    t.string "provenance", default: "explicit"
    t.date "start_date"
    t.datetime "updated_at", null: false
    t.index ["candidate_id"], name: "index_candidate_experiences_on_candidate_id"
    t.index ["company_id", "candidate_id"], name: "index_candidate_experiences_on_company_id_and_candidate_id"
    t.index ["company_id"], name: "index_candidate_experiences_on_company_id"
  end

  create_table "candidate_job_matches", force: :cascade do |t|
    t.text "ai_explanation"
    t.jsonb "ai_metadata", default: {}
    t.bigint "candidate_id", null: false
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.datetime "evaluated_at"
    t.integer "experience_score", default: 0, null: false
    t.bigint "job_id", null: false
    t.integer "match_score", default: 0, null: false
    t.jsonb "matching_skills", default: []
    t.jsonb "missing_skills", default: []
    t.jsonb "potential_gaps", default: []
    t.integer "qualification_score", default: 0, null: false
    t.integer "skills_score", default: 0, null: false
    t.integer "status", default: 0, null: false
    t.jsonb "strong_matches", default: []
    t.datetime "updated_at", null: false
    t.index ["candidate_id"], name: "index_candidate_job_matches_on_candidate_id"
    t.index ["company_id", "candidate_id", "job_id"], name: "index_candidate_job_matches_uniqueness", unique: true
    t.index ["company_id", "job_id", "match_score"], name: "idx_on_company_id_job_id_match_score_ab8c8eca29"
    t.index ["company_id"], name: "index_candidate_job_matches_on_company_id"
    t.index ["job_id"], name: "index_candidate_job_matches_on_job_id"
  end

  create_table "candidate_qualifications", force: :cascade do |t|
    t.bigint "candidate_id", null: false
    t.bigint "company_id", null: false
    t.float "confidence", default: 1.0, null: false
    t.datetime "created_at", null: false
    t.string "degree", null: false
    t.string "field_of_study"
    t.string "institution"
    t.string "provenance", default: "explicit"
    t.datetime "updated_at", null: false
    t.integer "year_completed"
    t.index ["candidate_id"], name: "index_candidate_qualifications_on_candidate_id"
    t.index ["company_id", "candidate_id"], name: "index_candidate_qualifications_on_company_id_and_candidate_id"
    t.index ["company_id", "degree"], name: "index_candidate_qualifications_on_company_id_and_degree"
    t.index ["company_id"], name: "index_candidate_qualifications_on_company_id"
  end

  create_table "candidate_resumes", force: :cascade do |t|
    t.jsonb "ai_metadata", default: {}
    t.integer "ats_score"
    t.bigint "candidate_id"
    t.bigint "company_id", null: false
    t.string "content_type"
    t.datetime "created_at", null: false
    t.integer "criteria_match_percentage"
    t.bigint "duplicate_of_id"
    t.jsonb "eligibility_breakdown", default: {}
    t.text "error_message"
    t.jsonb "extracted_data", default: {}
    t.string "file_hash"
    t.string "file_name", null: false
    t.bigint "file_size"
    t.boolean "is_current", default: true, null: false
    t.datetime "processed_at"
    t.integer "processing_status", default: 0, null: false
    t.jsonb "provenance_data", default: {}
    t.text "raw_text"
    t.integer "retries_count", default: 0, null: false
    t.string "source_attachment_id"
    t.string "source_email_id"
    t.datetime "updated_at", null: false
    t.index ["candidate_id"], name: "index_candidate_resumes_on_candidate_id"
    t.index ["company_id", "file_hash"], name: "index_candidate_resumes_on_company_id_and_file_hash"
    t.index ["company_id", "processing_status"], name: "index_candidate_resumes_on_company_id_and_processing_status"
    t.index ["company_id"], name: "index_candidate_resumes_on_company_id"
    t.index ["duplicate_of_id"], name: "index_candidate_resumes_on_duplicate_of_id"
  end

  create_table "candidate_skills", force: :cascade do |t|
    t.bigint "candidate_id", null: false
    t.string "category"
    t.bigint "company_id", null: false
    t.float "confidence", default: 1.0, null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.string "provenance", default: "explicit"
    t.datetime "updated_at", null: false
    t.index ["candidate_id"], name: "index_candidate_skills_on_candidate_id"
    t.index ["company_id", "candidate_id"], name: "index_candidate_skills_on_company_id_and_candidate_id"
    t.index ["company_id", "name"], name: "index_candidate_skills_on_company_id_and_name"
    t.index ["company_id"], name: "index_candidate_skills_on_company_id"
  end

  create_table "candidates", force: :cascade do |t|
    t.decimal "academic_cgpa", precision: 4, scale: 2
    t.decimal "academic_percentage", precision: 5, scale: 2
    t.boolean "active_backlogs"
    t.string "calendly_booking_token"
    t.string "calendly_event_uri"
    t.string "calendly_invitee_uri"
    t.string "calendly_join_url"
    t.string "calendly_scheduling_url"
    t.string "city"
    t.bigint "company_id", null: false
    t.string "country"
    t.datetime "created_at", null: false
    t.string "current_location"
    t.string "current_role"
    t.integer "duplicate_status", default: 0, null: false
    t.string "email"
    t.decimal "experience_years", precision: 4, scale: 1, default: "0.0", null: false
    t.text "feedback_comments"
    t.integer "feedback_rating"
    t.datetime "feedback_requested_at"
    t.datetime "feedback_submitted_at"
    t.string "feedback_token"
    t.boolean "feedback_would_recommend"
    t.string "first_name"
    t.string "full_name"
    t.integer "graduation_year"
    t.string "highest_qualification"
    t.string "industry"
    t.datetime "interview_at"
    t.datetime "interview_link_sent_at"
    t.jsonb "interview_questions"
    t.datetime "interview_questions_generated_at"
    t.bigint "interview_questions_job_id"
    t.bigint "interviewer_id"
    t.string "interviewer_notified_invitee_uri"
    t.jsonb "languages", default: [], null: false
    t.string "last_name"
    t.text "notes"
    t.string "notice_period"
    t.string "phone"
    t.string "preferred_location"
    t.string "source", default: "manual_upload", null: false
    t.string "state"
    t.integer "status", default: 0, null: false
    t.jsonb "tags", default: []
    t.datetime "updated_at", null: false
    t.index ["calendly_booking_token"], name: "index_candidates_on_calendly_booking_token", unique: true
    t.index ["calendly_invitee_uri"], name: "index_candidates_on_calendly_invitee_uri"
    t.index ["company_id", "city"], name: "index_candidates_on_company_id_and_city"
    t.index ["company_id", "duplicate_status"], name: "index_candidates_on_company_id_and_duplicate_status"
    t.index ["company_id", "email"], name: "index_candidates_on_company_id_and_email"
    t.index ["company_id", "experience_years"], name: "index_candidates_on_company_id_and_experience_years"
    t.index ["company_id", "phone"], name: "index_candidates_on_company_id_and_phone"
    t.index ["company_id", "status"], name: "index_candidates_on_company_id_and_status"
    t.index ["company_id"], name: "index_candidates_on_company_id"
    t.index ["feedback_token"], name: "index_candidates_on_feedback_token", unique: true
    t.index ["interview_questions_job_id"], name: "index_candidates_on_interview_questions_job_id"
    t.index ["interviewer_id"], name: "index_candidates_on_interviewer_id"
  end

  create_table "companies", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "employee_code_initial"
    t.string "name", null: false
    t.string "slug", null: false
    t.integer "status", default: 0, null: false
    t.string "timezone", default: "UTC", null: false
    t.datetime "updated_at", null: false
    t.string "work_email_domain"
    t.index ["slug"], name: "index_companies_on_slug", unique: true
  end

  create_table "departments", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.text "description"
    t.string "name", null: false
    t.integer "status", default: 0, null: false
    t.datetime "updated_at", null: false
    t.index ["company_id", "name"], name: "index_departments_on_company_id_and_name", unique: true
    t.index ["company_id"], name: "index_departments_on_company_id"
  end

  create_table "designations", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.bigint "department_id"
    t.integer "level"
    t.integer "status", default: 0, null: false
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.index ["company_id", "title"], name: "index_designations_on_company_id_and_title"
    t.index ["company_id"], name: "index_designations_on_company_id"
    t.index ["department_id"], name: "index_designations_on_department_id"
  end

  create_table "documents", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.string "custom_category"
    t.string "document_type"
    t.bigint "employee_id"
    t.string "title"
    t.datetime "updated_at", null: false
    t.bigint "uploaded_by_id", null: false
    t.index ["company_id", "document_type"], name: "index_documents_on_company_id_and_document_type"
    t.index ["company_id", "employee_id"], name: "index_documents_on_company_id_and_employee_id"
    t.index ["company_id"], name: "index_documents_on_company_id"
    t.index ["employee_id"], name: "index_documents_on_employee_id"
    t.index ["uploaded_by_id"], name: "index_documents_on_uploaded_by_id"
  end

  create_table "employee_assets", force: :cascade do |t|
    t.integer "asset_type", default: 0, null: false
    t.date "assigned_on"
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.bigint "employee_id"
    t.string "identifier"
    t.string "name", null: false
    t.text "note"
    t.date "returned_on"
    t.integer "status", default: 0, null: false
    t.datetime "updated_at", null: false
    t.index ["company_id", "status"], name: "index_employee_assets_on_company_id_and_status"
    t.index ["company_id"], name: "index_employee_assets_on_company_id"
    t.index ["employee_id"], name: "index_employee_assets_on_employee_id"
  end

  create_table "employee_compensation_records", force: :cascade do |t|
    t.decimal "annual_compensation", precision: 12, scale: 2
    t.bigint "appraisal_id"
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.date "effective_on", null: false
    t.bigint "employee_id", null: false
    t.decimal "increment_percentage", precision: 5, scale: 2
    t.text "note"
    t.integer "reason", default: 0, null: false
    t.bigint "recorded_by_id"
    t.datetime "updated_at", null: false
    t.index ["appraisal_id"], name: "index_employee_compensation_records_on_appraisal_id"
    t.index ["company_id"], name: "index_employee_compensation_records_on_company_id"
    t.index ["employee_id", "effective_on"], name: "index_compensation_records_on_employee_and_date"
    t.index ["employee_id"], name: "index_employee_compensation_records_on_employee_id"
    t.index ["recorded_by_id"], name: "index_employee_compensation_records_on_recorded_by_id"
  end

  create_table "employee_employment_events", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.date "effective_on", null: false
    t.bigint "employee_id", null: false
    t.integer "event_type", null: false
    t.string "from_value"
    t.text "note"
    t.bigint "recorded_by_id"
    t.string "to_value"
    t.datetime "updated_at", null: false
    t.index ["company_id"], name: "index_employee_employment_events_on_company_id"
    t.index ["employee_id", "effective_on"], name: "index_employment_events_on_employee_and_date"
    t.index ["employee_id"], name: "index_employee_employment_events_on_employee_id"
    t.index ["recorded_by_id"], name: "index_employee_employment_events_on_recorded_by_id"
  end

  create_table "employee_goals", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.bigint "created_by_id"
    t.text "description"
    t.bigint "employee_id", null: false
    t.text "manager_comment"
    t.integer "priority", default: 1, null: false
    t.text "progress_note"
    t.bigint "source_appraisal_id"
    t.integer "status", default: 0, null: false
    t.text "success_criteria"
    t.date "target_date"
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.index ["company_id"], name: "index_employee_goals_on_company_id"
    t.index ["created_by_id"], name: "index_employee_goals_on_created_by_id"
    t.index ["employee_id", "status"], name: "index_employee_goals_on_employee_id_and_status"
    t.index ["employee_id"], name: "index_employee_goals_on_employee_id"
    t.index ["source_appraisal_id"], name: "index_employee_goals_on_source_appraisal_id"
  end

  create_table "employee_managers", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.bigint "employee_id", null: false
    t.bigint "manager_id", null: false
    t.integer "manager_level", null: false
    t.integer "tier"
    t.datetime "updated_at", null: false
    t.index ["company_id", "manager_id"], name: "index_employee_managers_on_company_and_manager"
    t.index ["company_id"], name: "index_employee_managers_on_company_id"
    t.index ["employee_id", "manager_level", "manager_id"], name: "index_employee_managers_uniqueness", unique: true
    t.index ["employee_id"], name: "index_employee_managers_on_employee_id"
    t.index ["manager_id"], name: "index_employee_managers_on_manager_id"
  end

  create_table "employee_skills", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.bigint "employee_id", null: false
    t.text "evidence"
    t.string "name", null: false
    t.integer "proficiency", default: 0, null: false
    t.datetime "updated_at", null: false
    t.boolean "validated", default: false, null: false
    t.bigint "validated_by_id"
    t.date "validated_on"
    t.index ["company_id"], name: "index_employee_skills_on_company_id"
    t.index ["employee_id", "name"], name: "index_employee_skills_uniqueness", unique: true
    t.index ["employee_id"], name: "index_employee_skills_on_employee_id"
    t.index ["validated_by_id"], name: "index_employee_skills_on_validated_by_id"
  end

  create_table "employee_trainings", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.date "completed_on"
    t.datetime "created_at", null: false
    t.text "description"
    t.bigint "employee_id", null: false
    t.date "identified_on"
    t.string "name", null: false
    t.bigint "source_appraisal_id"
    t.integer "status", default: 0, null: false
    t.datetime "updated_at", null: false
    t.bigint "validated_by_id"
    t.index ["company_id"], name: "index_employee_trainings_on_company_id"
    t.index ["employee_id", "status"], name: "index_employee_trainings_on_employee_id_and_status"
    t.index ["employee_id"], name: "index_employee_trainings_on_employee_id"
    t.index ["source_appraisal_id"], name: "index_employee_trainings_on_source_appraisal_id"
    t.index ["validated_by_id"], name: "index_employee_trainings_on_validated_by_id"
  end

  create_table "employees", force: :cascade do |t|
    t.string "address_line1"
    t.string "address_line2"
    t.string "city"
    t.bigint "company_id", null: false
    t.string "country"
    t.datetime "created_at", null: false
    t.integer "current_level"
    t.date "date_of_birth"
    t.date "date_of_joining"
    t.bigint "department_id"
    t.bigint "designation_id"
    t.string "emergency_contact_name"
    t.string "emergency_contact_phone"
    t.string "employee_code", null: false
    t.integer "employment_type"
    t.string "first_name", null: false
    t.string "gender"
    t.string "last_name", null: false
    t.string "personal_email"
    t.string "phone"
    t.string "postal_code"
    t.string "state"
    t.integer "status", default: 0, null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id"
    t.string "work_location"
    t.index ["company_id", "current_level"], name: "index_employees_on_company_id_and_current_level"
    t.index ["company_id", "department_id"], name: "index_employees_on_company_id_and_department_id"
    t.index ["company_id", "employee_code"], name: "index_employees_on_company_id_and_employee_code", unique: true
    t.index ["company_id", "status"], name: "index_employees_on_company_id_and_status"
    t.index ["company_id"], name: "index_employees_on_company_id"
    t.index ["department_id"], name: "index_employees_on_department_id"
    t.index ["designation_id"], name: "index_employees_on_designation_id"
    t.index ["user_id"], name: "index_employees_on_user_id"
  end

  create_table "jobs", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.bigint "department_id"
    t.text "description"
    t.string "location"
    t.decimal "min_experience_years", precision: 4, scale: 1, default: "0.0", null: false
    t.jsonb "required_qualifications", default: []
    t.jsonb "required_skills", default: []
    t.integer "status", default: 0, null: false
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.index ["company_id", "status"], name: "index_jobs_on_company_id_and_status"
    t.index ["company_id"], name: "index_jobs_on_company_id"
    t.index ["department_id"], name: "index_jobs_on_department_id"
  end

  create_table "leave_requests", force: :cascade do |t|
    t.datetime "approved_at"
    t.bigint "approved_by_id"
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.bigint "employee_id", null: false
    t.date "end_date"
    t.string "leave_type"
    t.text "reason"
    t.date "start_date"
    t.integer "status", default: 0, null: false
    t.datetime "updated_at", null: false
    t.index ["approved_by_id"], name: "index_leave_requests_on_approved_by_id"
    t.index ["company_id", "status"], name: "index_leave_requests_on_company_id_and_status"
    t.index ["company_id"], name: "index_leave_requests_on_company_id"
    t.index ["employee_id", "start_date"], name: "index_leave_requests_on_employee_id_and_start_date"
    t.index ["employee_id"], name: "index_leave_requests_on_employee_id"
  end

  create_table "notifications", force: :cascade do |t|
    t.string "action_url"
    t.text "body"
    t.string "category", null: false
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.jsonb "email_context", default: [], null: false
    t.bigint "notifiable_id"
    t.string "notifiable_type"
    t.datetime "read_at"
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["company_id", "created_at"], name: "index_notifications_on_company_id_and_created_at"
    t.index ["company_id"], name: "index_notifications_on_company_id"
    t.index ["notifiable_type", "notifiable_id"], name: "index_notifications_on_notifiable_type_and_notifiable_id"
    t.index ["user_id", "read_at"], name: "index_notifications_on_user_id_and_read_at"
    t.index ["user_id"], name: "index_notifications_on_user_id"
  end

  create_table "performance_improvement_plans", force: :cascade do |t|
    t.date "closed_on"
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.text "employee_comments"
    t.bigint "employee_id", null: false
    t.text "expected_improvement"
    t.text "issue_description", null: false
    t.text "measurable_targets"
    t.bigint "opened_by_id"
    t.text "outcome_note"
    t.date "review_on"
    t.date "starts_on"
    t.integer "status", default: 0, null: false
    t.text "support_provided"
    t.datetime "updated_at", null: false
    t.index ["company_id", "status"], name: "index_performance_improvement_plans_on_company_id_and_status"
    t.index ["company_id"], name: "index_performance_improvement_plans_on_company_id"
    t.index ["employee_id"], name: "index_performance_improvement_plans_on_employee_id"
    t.index ["opened_by_id"], name: "index_performance_improvement_plans_on_opened_by_id"
  end

  create_table "permissions", force: :cascade do |t|
    t.string "action", null: false
    t.datetime "created_at", null: false
    t.text "description"
    t.string "key", null: false
    t.string "resource", null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_permissions_on_key", unique: true
  end

  create_table "role_permissions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "permission_id", null: false
    t.bigint "role_id", null: false
    t.datetime "updated_at", null: false
    t.index ["permission_id"], name: "index_role_permissions_on_permission_id"
    t.index ["role_id", "permission_id"], name: "index_role_permissions_on_role_and_permission", unique: true
    t.index ["role_id"], name: "index_role_permissions_on_role_id"
  end

  create_table "roles", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.text "description"
    t.string "name", null: false
    t.string "slug", null: false
    t.boolean "system_default", default: false, null: false
    t.datetime "updated_at", null: false
    t.index ["company_id", "slug"], name: "index_roles_on_company_id_and_slug", unique: true
    t.index ["company_id"], name: "index_roles_on_company_id"
  end

  create_table "sessions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "expires_at"
    t.string "ip_address"
    t.datetime "updated_at", null: false
    t.string "user_agent"
    t.bigint "user_id", null: false
    t.index ["user_id"], name: "index_sessions_on_user_id"
  end

  create_table "user_roles", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.bigint "role_id", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["company_id"], name: "index_user_roles_on_company_id"
    t.index ["role_id"], name: "index_user_roles_on_role_id"
    t.index ["user_id", "role_id"], name: "index_user_roles_on_user_and_role", unique: true
    t.index ["user_id"], name: "index_user_roles_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.datetime "credentials_sent_at"
    t.string "email_address", null: false
    t.datetime "email_verified_at"
    t.string "first_name", null: false
    t.datetime "invitation_accepted_at"
    t.datetime "last_login_at"
    t.string "last_name", null: false
    t.boolean "must_change_password", default: false, null: false
    t.string "password_digest", null: false
    t.integer "status", default: 0, null: false
    t.datetime "updated_at", null: false
    t.index ["company_id", "credentials_sent_at"], name: "index_users_on_company_id_and_credentials_sent_at"
    t.index ["company_id", "status"], name: "index_users_on_company_id_and_status"
    t.index ["company_id"], name: "index_users_on_company_id"
    t.index ["email_address"], name: "index_users_on_email_address", unique: true
  end

  create_table "zoho_connections", force: :cascade do |t|
    t.text "access_token"
    t.bigint "company_id", null: false
    t.integer "connection_type", default: 0, null: false
    t.datetime "created_at", null: false
    t.string "email_address", null: false
    t.datetime "last_synced_at"
    t.text "refresh_token"
    t.string "scopes"
    t.integer "status", default: 0, null: false
    t.datetime "token_expires_at"
    t.datetime "updated_at", null: false
    t.bigint "user_id"
    t.index ["company_id", "user_id"], name: "index_zoho_connections_on_company_id_and_user_id"
    t.index ["company_id"], name: "index_zoho_connections_on_company_id"
    t.index ["user_id"], name: "index_zoho_connections_on_user_id"
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "ai_processing_logs", "candidate_resumes"
  add_foreign_key "ai_processing_logs", "candidates"
  add_foreign_key "ai_processing_logs", "companies"
  add_foreign_key "ai_processing_logs", "jobs"
  add_foreign_key "appraisal_answers", "appraisal_revisions"
  add_foreign_key "appraisal_answers", "appraisal_template_questions"
  add_foreign_key "appraisal_answers", "companies"
  add_foreign_key "appraisal_comments", "appraisal_revisions"
  add_foreign_key "appraisal_comments", "appraisals"
  add_foreign_key "appraisal_comments", "companies"
  add_foreign_key "appraisal_comments", "users", column: "author_user_id"
  add_foreign_key "appraisal_compensation_decisions", "appraisals"
  add_foreign_key "appraisal_compensation_decisions", "companies"
  add_foreign_key "appraisal_compensation_decisions", "designations", column: "current_designation_id"
  add_foreign_key "appraisal_compensation_decisions", "designations", column: "proposed_designation_id"
  add_foreign_key "appraisal_compensation_decisions", "users", column: "actor_user_id"
  add_foreign_key "appraisal_cycle_participants", "appraisal_cycles"
  add_foreign_key "appraisal_cycle_participants", "companies"
  add_foreign_key "appraisal_cycle_participants", "employees"
  add_foreign_key "appraisal_cycles", "appraisal_templates"
  add_foreign_key "appraisal_cycles", "companies"
  add_foreign_key "appraisal_cycles", "users", column: "created_by_id"
  add_foreign_key "appraisal_feedback_requests", "appraisals"
  add_foreign_key "appraisal_feedback_requests", "companies"
  add_foreign_key "appraisal_feedback_requests", "employees", column: "requested_from_id"
  add_foreign_key "appraisal_feedback_requests", "users", column: "requested_by_id"
  add_foreign_key "appraisal_revisions", "appraisals"
  add_foreign_key "appraisal_revisions", "companies"
  add_foreign_key "appraisal_revisions", "employees", column: "author_employee_id"
  add_foreign_key "appraisal_revisions", "users", column: "author_user_id"
  add_foreign_key "appraisal_score_overrides", "appraisals"
  add_foreign_key "appraisal_score_overrides", "companies"
  add_foreign_key "appraisal_score_overrides", "users", column: "actor_user_id"
  add_foreign_key "appraisal_template_categories", "appraisal_templates"
  add_foreign_key "appraisal_template_categories", "companies"
  add_foreign_key "appraisal_template_questions", "appraisal_template_categories"
  add_foreign_key "appraisal_template_questions", "companies"
  add_foreign_key "appraisal_templates", "companies"
  add_foreign_key "appraisal_templates", "users", column: "created_by_id"
  add_foreign_key "appraisal_transitions", "appraisals"
  add_foreign_key "appraisal_transitions", "companies"
  add_foreign_key "appraisal_transitions", "users", column: "actor_user_id"
  add_foreign_key "appraisals", "appraisal_cycles"
  add_foreign_key "appraisals", "companies"
  add_foreign_key "appraisals", "employees"
  add_foreign_key "appraisals", "employees", column: "final_manager_id"
  add_foreign_key "appraisals", "employees", column: "primary_manager_id"
  add_foreign_key "appraisals", "employees", column: "secondary_manager_id"
  add_foreign_key "appraisals", "users", column: "released_by_id"
  add_foreign_key "attendance_records", "companies"
  add_foreign_key "attendance_records", "employees"
  add_foreign_key "audit_logs", "companies"
  add_foreign_key "audit_logs", "users", column: "actor_id"
  add_foreign_key "calendly_connections", "companies"
  add_foreign_key "calendly_connections", "users"
  add_foreign_key "candidate_certifications", "candidates"
  add_foreign_key "candidate_certifications", "companies"
  add_foreign_key "candidate_experiences", "candidates"
  add_foreign_key "candidate_experiences", "companies"
  add_foreign_key "candidate_job_matches", "candidates"
  add_foreign_key "candidate_job_matches", "companies"
  add_foreign_key "candidate_job_matches", "jobs"
  add_foreign_key "candidate_qualifications", "candidates"
  add_foreign_key "candidate_qualifications", "companies"
  add_foreign_key "candidate_resumes", "candidate_resumes", column: "duplicate_of_id"
  add_foreign_key "candidate_resumes", "candidates"
  add_foreign_key "candidate_resumes", "companies"
  add_foreign_key "candidate_skills", "candidates"
  add_foreign_key "candidate_skills", "companies"
  add_foreign_key "candidates", "companies"
  add_foreign_key "candidates", "employees", column: "interviewer_id"
  add_foreign_key "candidates", "jobs", column: "interview_questions_job_id"
  add_foreign_key "departments", "companies"
  add_foreign_key "designations", "companies"
  add_foreign_key "designations", "departments"
  add_foreign_key "documents", "companies"
  add_foreign_key "documents", "employees"
  add_foreign_key "documents", "users", column: "uploaded_by_id"
  add_foreign_key "employee_assets", "companies"
  add_foreign_key "employee_assets", "employees"
  add_foreign_key "employee_compensation_records", "appraisals"
  add_foreign_key "employee_compensation_records", "companies"
  add_foreign_key "employee_compensation_records", "employees"
  add_foreign_key "employee_compensation_records", "users", column: "recorded_by_id"
  add_foreign_key "employee_employment_events", "companies"
  add_foreign_key "employee_employment_events", "employees"
  add_foreign_key "employee_employment_events", "users", column: "recorded_by_id"
  add_foreign_key "employee_goals", "appraisals", column: "source_appraisal_id"
  add_foreign_key "employee_goals", "companies"
  add_foreign_key "employee_goals", "employees"
  add_foreign_key "employee_goals", "users", column: "created_by_id"
  add_foreign_key "employee_managers", "companies"
  add_foreign_key "employee_managers", "employees"
  add_foreign_key "employee_managers", "employees", column: "manager_id"
  add_foreign_key "employee_skills", "companies"
  add_foreign_key "employee_skills", "employees"
  add_foreign_key "employee_skills", "users", column: "validated_by_id"
  add_foreign_key "employee_trainings", "appraisals", column: "source_appraisal_id"
  add_foreign_key "employee_trainings", "companies"
  add_foreign_key "employee_trainings", "employees"
  add_foreign_key "employee_trainings", "users", column: "validated_by_id"
  add_foreign_key "employees", "companies"
  add_foreign_key "employees", "departments"
  add_foreign_key "employees", "designations"
  add_foreign_key "employees", "users"
  add_foreign_key "jobs", "companies"
  add_foreign_key "jobs", "departments"
  add_foreign_key "leave_requests", "companies"
  add_foreign_key "leave_requests", "employees"
  add_foreign_key "leave_requests", "users", column: "approved_by_id"
  add_foreign_key "notifications", "companies"
  add_foreign_key "notifications", "users"
  add_foreign_key "performance_improvement_plans", "companies"
  add_foreign_key "performance_improvement_plans", "employees"
  add_foreign_key "performance_improvement_plans", "users", column: "opened_by_id"
  add_foreign_key "role_permissions", "permissions"
  add_foreign_key "role_permissions", "roles"
  add_foreign_key "roles", "companies"
  add_foreign_key "sessions", "users"
  add_foreign_key "user_roles", "companies"
  add_foreign_key "user_roles", "roles"
  add_foreign_key "user_roles", "users"
  add_foreign_key "users", "companies"
  add_foreign_key "zoho_connections", "companies"
  add_foreign_key "zoho_connections", "users"
end

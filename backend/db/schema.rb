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

ActiveRecord::Schema[8.1].define(version: 2026_09_09_062251) do
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
    t.bigint "candidate_id"
    t.bigint "company_id", null: false
    t.string "content_type"
    t.datetime "created_at", null: false
    t.bigint "duplicate_of_id"
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
    t.string "city"
    t.bigint "company_id", null: false
    t.string "country"
    t.datetime "created_at", null: false
    t.string "current_location"
    t.string "current_role"
    t.integer "duplicate_status", default: 0, null: false
    t.string "email"
    t.decimal "experience_years", precision: 4, scale: 1, default: "0.0", null: false
    t.string "first_name"
    t.string "full_name"
    t.string "highest_qualification"
    t.string "industry"
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
    t.index ["company_id", "city"], name: "index_candidates_on_company_id_and_city"
    t.index ["company_id", "duplicate_status"], name: "index_candidates_on_company_id_and_duplicate_status"
    t.index ["company_id", "email"], name: "index_candidates_on_company_id_and_email"
    t.index ["company_id", "experience_years"], name: "index_candidates_on_company_id_and_experience_years"
    t.index ["company_id", "phone"], name: "index_candidates_on_company_id_and_phone"
    t.index ["company_id", "status"], name: "index_candidates_on_company_id_and_status"
    t.index ["company_id"], name: "index_candidates_on_company_id"
  end

  create_table "companies", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.string "slug", null: false
    t.integer "status", default: 0, null: false
    t.string "timezone", default: "UTC", null: false
    t.datetime "updated_at", null: false
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
    t.string "document_type"
    t.bigint "employee_id"
    t.string "title"
    t.datetime "updated_at", null: false
    t.bigint "uploaded_by_id", null: false
    t.index ["company_id", "employee_id"], name: "index_documents_on_company_id_and_employee_id"
    t.index ["company_id"], name: "index_documents_on_company_id"
    t.index ["employee_id"], name: "index_documents_on_employee_id"
    t.index ["uploaded_by_id"], name: "index_documents_on_uploaded_by_id"
  end

  create_table "employees", force: :cascade do |t|
    t.string "address_line1"
    t.string "address_line2"
    t.string "city"
    t.bigint "company_id", null: false
    t.string "country"
    t.datetime "created_at", null: false
    t.date "date_of_birth"
    t.date "date_of_joining"
    t.bigint "department_id"
    t.bigint "designation_id"
    t.string "emergency_contact_name"
    t.string "emergency_contact_phone"
    t.string "employee_code", null: false
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
    t.string "email_address", null: false
    t.datetime "email_verified_at"
    t.string "first_name", null: false
    t.datetime "last_login_at"
    t.string "last_name", null: false
    t.string "password_digest", null: false
    t.integer "status", default: 0, null: false
    t.datetime "updated_at", null: false
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
  add_foreign_key "attendance_records", "companies"
  add_foreign_key "attendance_records", "employees"
  add_foreign_key "audit_logs", "companies"
  add_foreign_key "audit_logs", "users", column: "actor_id"
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
  add_foreign_key "departments", "companies"
  add_foreign_key "designations", "companies"
  add_foreign_key "designations", "departments"
  add_foreign_key "documents", "companies"
  add_foreign_key "documents", "employees"
  add_foreign_key "documents", "users", column: "uploaded_by_id"
  add_foreign_key "employees", "companies"
  add_foreign_key "employees", "departments"
  add_foreign_key "employees", "designations"
  add_foreign_key "employees", "users"
  add_foreign_key "jobs", "companies"
  add_foreign_key "jobs", "departments"
  add_foreign_key "leave_requests", "companies"
  add_foreign_key "leave_requests", "employees"
  add_foreign_key "leave_requests", "users", column: "approved_by_id"
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

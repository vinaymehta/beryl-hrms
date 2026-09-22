# Scope Phase 1 (Employee Core) and Phase 5 (Continuous Performance).
#
# Phase 1's headline requirement is §3's "structured history rather than
# overwriting past values" — so the two history tables here are the point of it.
# `employee_employment_events` is written automatically by Employee callbacks
# rather than by a form: history you have to remember to record isn't history.
#
# Phase 5 adds one table per concept the scope names, plus a single column on
# appraisal_cycles for §22 review types — the existing cycle/template/workflow
# machinery serves every review type unchanged, so nothing there is duplicated.
class CreateEmployeeRecordsAndContinuousPerformance < ActiveRecord::Migration[8.1]
  def change
    # --- Phase 1: profile fields the scope names (§3) ----------------------
    # `status` already covers the lifecycle (active/inactive/offboarded);
    # employment TYPE is a different axis the scope lists separately.
    add_column :employees, :employment_type, :integer
    add_column :employees, :work_location, :string

    # --- Phase 1: employment history (§3, §26) -----------------------------
    create_table :employee_employment_events do |t|
      t.references :company, null: false, foreign_key: true
      t.references :employee, null: false, foreign_key: true
      t.integer :event_type, null: false
      # Free-text from/to rather than FKs on purpose: §26 requires historical
      # records not to change when the thing they reference does. A designation
      # later renamed or deleted must not rewrite what someone's title was.
      t.string :from_value
      t.string :to_value
      t.date :effective_on, null: false
      t.text :note
      t.references :recorded_by, foreign_key: { to_table: :users }

      t.timestamps
    end
    add_index :employee_employment_events, [ :employee_id, :effective_on ],
              name: "index_employment_events_on_employee_and_date"

    # --- Phase 1: compensation history (§3, §17) ---------------------------
    # Separate from employment history because the ACCESS differs: this is
    # restricted data, gated on its own permission key.
    create_table :employee_compensation_records do |t|
      t.references :company, null: false, foreign_key: true
      t.references :employee, null: false, foreign_key: true
      t.decimal :annual_compensation, precision: 12, scale: 2
      t.decimal :increment_percentage, precision: 5, scale: 2
      t.date :effective_on, null: false
      t.integer :reason, default: 0, null: false
      t.text :note
      # Set when the record came out of an appraisal, so a cycle's outcome and
      # the employee's pay history are the same fact rather than two.
      t.references :appraisal, foreign_key: true
      t.references :recorded_by, foreign_key: { to_table: :users }

      t.timestamps
    end
    add_index :employee_compensation_records, [ :employee_id, :effective_on ],
              name: "index_compensation_records_on_employee_and_date"

    # --- Phase 1: company assets (§3) --------------------------------------
    create_table :employee_assets do |t|
      t.references :company, null: false, foreign_key: true
      t.references :employee, foreign_key: true
      t.string :name, null: false
      t.integer :asset_type, default: 0, null: false
      t.string :identifier
      t.integer :status, default: 0, null: false
      t.date :assigned_on
      t.date :returned_on
      t.text :note

      t.timestamps
    end
    add_index :employee_assets, [ :company_id, :status ]

    # --- Phase 5: goals (§19) ----------------------------------------------
    create_table :employee_goals do |t|
      t.references :company, null: false, foreign_key: true
      t.references :employee, null: false, foreign_key: true
      t.string :title, null: false
      t.text :description
      t.text :success_criteria
      t.integer :priority, default: 1, null: false
      t.integer :status, default: 0, null: false
      t.date :target_date
      t.text :progress_note
      t.text :manager_comment
      # §19: goals come out of a finalized appraisal and surface in the next
      # review. Nullable so a goal can also be set outside a cycle.
      t.references :source_appraisal, foreign_key: { to_table: :appraisals }
      t.references :created_by, foreign_key: { to_table: :users }

      t.timestamps
    end
    add_index :employee_goals, [ :employee_id, :status ]

    # --- Phase 5: skill matrix (§20) ---------------------------------------
    # Employee-scoped and deliberately NOT candidate_skills, which belongs to a
    # recruitment Candidate and carries AI provenance fields irrelevant here.
    create_table :employee_skills do |t|
      t.references :company, null: false, foreign_key: true
      t.references :employee, null: false, foreign_key: true
      t.string :name, null: false
      t.integer :proficiency, default: 0, null: false
      t.text :evidence
      t.boolean :validated, default: false, null: false
      t.references :validated_by, foreign_key: { to_table: :users }
      t.date :validated_on

      t.timestamps
    end
    add_index :employee_skills, [ :employee_id, :name ], unique: true,
              name: "index_employee_skills_uniqueness"

    # --- Phase 5: training (§20) -------------------------------------------
    create_table :employee_trainings do |t|
      t.references :company, null: false, foreign_key: true
      t.references :employee, null: false, foreign_key: true
      t.string :name, null: false
      t.text :description
      # §20's lifecycle: Identified → Assigned → Completed → Manager Validated.
      t.integer :status, default: 0, null: false
      t.date :identified_on
      t.date :completed_on
      t.references :source_appraisal, foreign_key: { to_table: :appraisals }
      t.references :validated_by, foreign_key: { to_table: :users }

      t.timestamps
    end
    add_index :employee_trainings, [ :employee_id, :status ]

    # --- Phase 5: review types (§22) ---------------------------------------
    # One column, not a second workflow. Every review type runs through the
    # existing cycle/template/state-machine unchanged.
    add_column :appraisal_cycles, :review_type, :integer, default: 0, null: false
    add_index :appraisal_cycles, [ :company_id, :review_type ]

    # --- Phase 5: optional 360° feedback (§21) -----------------------------
    # Request and response in one row: the scope asks for optional additional
    # feedback, not a threaded conversation.
    create_table :appraisal_feedback_requests do |t|
      t.references :company, null: false, foreign_key: true
      t.references :appraisal, null: false, foreign_key: true
      t.references :requested_from, null: false, foreign_key: { to_table: :employees }
      t.references :requested_by, foreign_key: { to_table: :users }
      t.text :prompt
      t.text :response
      t.integer :status, default: 0, null: false
      # Same two-audience rule as appraisal_comments (§13).
      t.integer :visibility, default: 1, null: false
      t.datetime :responded_at

      t.timestamps
    end
    add_index :appraisal_feedback_requests, [ :appraisal_id, :requested_from_id ],
              unique: true, name: "index_feedback_requests_uniqueness"

    # --- Phase 5: PIP (§23) ------------------------------------------------
    create_table :performance_improvement_plans do |t|
      t.references :company, null: false, foreign_key: true
      t.references :employee, null: false, foreign_key: true
      t.text :issue_description, null: false
      t.text :expected_improvement
      t.text :measurable_targets
      t.text :support_provided
      t.text :employee_comments
      t.text :outcome_note
      t.integer :status, default: 0, null: false
      t.date :starts_on
      t.date :review_on
      t.date :closed_on
      t.references :opened_by, foreign_key: { to_table: :users }

      t.timestamps
    end
    add_index :performance_improvement_plans, [ :company_id, :status ]
  end
end

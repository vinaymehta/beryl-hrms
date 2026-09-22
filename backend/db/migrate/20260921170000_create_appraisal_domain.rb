# The Performance Appraisal domain.
#
# Shape of the thing, because the table list alone doesn't show it:
#
#   AppraisalTemplate (versioned, frozen once a cycle uses it)
#     └─ Categories (weighted, must total 100) → Questions
#
#   AppraisalCycle (configurable; no hardcoded "Appraisal 2026")
#     └─ Participants (eligible employees, editable while draft)
#         └─ Appraisal (one per eligible employee, created when the cycle starts)
#             ├─ Revisions  V1 self → V2 primary → V3 secondary → Final  [IMMUTABLE]
#             │    └─ Answers (that author's own ratings; never merged)
#             ├─ Comments (employee_visible | management_only)
#             ├─ Transitions (every status change, with actor)
#             ├─ ScoreOverrides (calculated value always preserved)
#             └─ CompensationDecision (restricted)
#
# Two versionings are deliberately kept apart: TEMPLATE version (which question
# set) and REVISION version_number (V1/V2/V3/…). Neither drives the other.
class CreateAppraisalDomain < ActiveRecord::Migration[8.1]
  def change
    # --- Templates ---------------------------------------------------------
    create_table :appraisal_templates do |t|
      t.references :company, null: false, foreign_key: true
      t.string :name, null: false
      t.text :description
      t.integer :status, default: 0, null: false
      t.integer :version, default: 1, null: false
      # Points at the first template in the chain, so v1→v2→v3 of "Annual
      # Review" stay findable together without mutating any of them.
      t.bigint :lineage_id
      t.references :created_by, foreign_key: { to_table: :users }

      t.timestamps
    end
    add_index :appraisal_templates, [ :company_id, :status ]
    add_index :appraisal_templates, [ :company_id, :lineage_id, :version ],
              unique: true, name: "index_appraisal_templates_on_lineage_version"

    create_table :appraisal_template_categories do |t|
      t.references :company, null: false, foreign_key: true
      t.references :appraisal_template, null: false, foreign_key: true
      t.string :name, null: false
      t.text :description
      # The three performance lenses. Weights are per-category; the lens is how
      # they roll up for reporting (Past 60 / Current 25 / Future 15).
      t.integer :lens, default: 0, null: false
      t.decimal :weight, precision: 5, scale: 2, default: "0.0", null: false
      t.integer :position, default: 0, null: false

      t.timestamps
    end
    add_index :appraisal_template_categories, [ :appraisal_template_id, :position ],
              name: "index_appraisal_categories_on_template_and_position"

    create_table :appraisal_template_questions do |t|
      t.references :company, null: false, foreign_key: true
      t.references :appraisal_template_category, null: false, foreign_key: true,
                   index: { name: "index_appraisal_questions_on_category" }
      t.string :prompt, null: false
      t.text :description
      t.integer :position, default: 0, null: false
      t.boolean :self_rating, default: true, null: false
      t.boolean :manager_rating, default: true, null: false
      t.boolean :requires_comment, default: false, null: false
      t.boolean :required, default: true, null: false

      t.timestamps
    end

    # --- Cycles ------------------------------------------------------------
    create_table :appraisal_cycles do |t|
      t.references :company, null: false, foreign_key: true
      t.references :appraisal_template, null: false, foreign_key: true
      t.string :name, null: false
      t.text :description
      t.integer :status, default: 0, null: false
      t.date :assessment_period_start
      t.date :assessment_period_end
      t.date :starts_on
      t.date :employee_submission_deadline
      t.date :primary_review_deadline
      t.date :secondary_review_deadline
      t.date :finalization_deadline
      t.date :compensation_effective_date
      # Whether THIS cycle runs the optional secondary step at all. Separate
      # from whether a given employee happens to have a secondary manager.
      t.boolean :secondary_review_enabled, default: false, null: false
      t.references :created_by, foreign_key: { to_table: :users }
      t.datetime :started_at
      t.datetime :closed_at

      t.timestamps
    end
    add_index :appraisal_cycles, [ :company_id, :status ]

    create_table :appraisal_cycle_participants do |t|
      t.references :company, null: false, foreign_key: true
      t.references :appraisal_cycle, null: false, foreign_key: true
      t.references :employee, null: false, foreign_key: true

      t.timestamps
    end
    add_index :appraisal_cycle_participants, [ :appraisal_cycle_id, :employee_id ],
              unique: true, name: "index_appraisal_participants_uniqueness"

    # --- Appraisal instances ----------------------------------------------
    create_table :appraisals do |t|
      t.references :company, null: false, foreign_key: true
      t.references :appraisal_cycle, null: false, foreign_key: true
      t.references :employee, null: false, foreign_key: true
      t.integer :status, default: 0, null: false

      # Snapshotted from the employee_managers hierarchy when the cycle starts.
      # A later reorg must not silently redirect an in-flight appraisal to a
      # different reviewer, nor orphan one already part-completed.
      t.bigint :primary_manager_id
      t.bigint :secondary_manager_id
      t.bigint :final_manager_id

      t.decimal :calculated_score, precision: 6, scale: 2
      t.decimal :final_score, precision: 6, scale: 2

      t.datetime :released_at
      t.references :released_by, foreign_key: { to_table: :users }
      t.datetime :acknowledged_at
      t.text :acknowledgement_note

      t.timestamps
    end
    add_index :appraisals, [ :appraisal_cycle_id, :employee_id ],
              unique: true, name: "index_appraisals_uniqueness"
    add_index :appraisals, [ :company_id, :status ]
    add_index :appraisals, [ :company_id, :primary_manager_id ]
    add_index :appraisals, [ :company_id, :secondary_manager_id ]
    add_index :appraisals, [ :company_id, :final_manager_id ]
    add_foreign_key :appraisals, :employees, column: :primary_manager_id
    add_foreign_key :appraisals, :employees, column: :secondary_manager_id
    add_foreign_key :appraisals, :employees, column: :final_manager_id

    # --- Revisions (immutable) --------------------------------------------
    create_table :appraisal_revisions do |t|
      t.references :company, null: false, foreign_key: true
      t.references :appraisal, null: false, foreign_key: true
      # Derived from the revision history (MAX + 1), never hardcoded to 1/2/3 —
      # a returned-for-correction appraisal just adds another one.
      t.integer :version_number, null: false
      t.integer :stage, null: false
      t.references :author_employee, foreign_key: { to_table: :employees }
      t.references :author_user, foreign_key: { to_table: :users }
      t.datetime :submitted_at, null: false

      t.text :summary
      t.text :achievements
      t.text :strengths
      t.text :improvement_areas
      t.text :training_needs
      t.text :next_period_goals

      t.decimal :calculated_score, precision: 6, scale: 2

      t.timestamps
    end
    add_index :appraisal_revisions, [ :appraisal_id, :version_number ],
              unique: true, name: "index_appraisal_revisions_uniqueness"
    add_index :appraisal_revisions, [ :appraisal_id, :stage ]

    create_table :appraisal_answers do |t|
      t.references :company, null: false, foreign_key: true
      t.references :appraisal_revision, null: false, foreign_key: true,
                   index: { name: "index_appraisal_answers_on_revision" }
      t.references :appraisal_template_question, null: false, foreign_key: true,
                   index: { name: "index_appraisal_answers_on_question" }
      t.integer :rating
      t.text :comment

      t.timestamps
    end
    add_index :appraisal_answers, [ :appraisal_revision_id, :appraisal_template_question_id ],
              unique: true, name: "index_appraisal_answers_uniqueness"

    # --- Workflow trail ----------------------------------------------------
    create_table :appraisal_comments do |t|
      t.references :company, null: false, foreign_key: true
      t.references :appraisal, null: false, foreign_key: true
      t.references :appraisal_revision, foreign_key: true,
                   index: { name: "index_appraisal_comments_on_revision" }
      t.references :author_user, null: false, foreign_key: { to_table: :users }
      t.text :body, null: false
      # 0 employee_visible / 1 management_only. Read by the serializer on every
      # request — an employee never receives a management_only row at all.
      t.integer :visibility, default: 1, null: false

      t.timestamps
    end
    add_index :appraisal_comments, [ :appraisal_id, :visibility ]

    create_table :appraisal_transitions do |t|
      t.references :company, null: false, foreign_key: true
      t.references :appraisal, null: false, foreign_key: true
      t.references :actor_user, foreign_key: { to_table: :users }
      t.integer :from_status
      t.integer :to_status, null: false
      t.text :notes

      t.timestamps
    end
    add_index :appraisal_transitions, [ :appraisal_id, :created_at ]

    create_table :appraisal_score_overrides do |t|
      t.references :company, null: false, foreign_key: true
      t.references :appraisal, null: false, foreign_key: true
      t.references :actor_user, foreign_key: { to_table: :users }
      # Both sides kept: the calculated value is never lost to an override.
      t.decimal :previous_score, precision: 6, scale: 2
      t.decimal :new_score, precision: 6, scale: 2, null: false
      t.text :reason, null: false

      t.timestamps
    end

    # §17 Compensation & Increment and §18 Promotion / Role Change.
    #
    # Increment and promotion are INDEPENDENT sets of columns, not one enum:
    # the scope is explicit that "promotion decisions should be independent
    # from increments". And RECOMMENDED is stored apart from APPROVED, so a
    # reviewer's proposal survives the approval that changed it.
    create_table :appraisal_compensation_decisions do |t|
      t.references :company, null: false, foreign_key: true
      t.references :appraisal, null: false, foreign_key: true, index: { unique: true }
      t.references :actor_user, foreign_key: { to_table: :users }

      # Context the decision is made against.
      t.decimal :current_compensation, precision: 12, scale: 2
      t.decimal :last_increment_percentage, precision: 5, scale: 2
      t.date :last_increment_on

      t.decimal :recommended_increment_percentage, precision: 5, scale: 2
      t.decimal :recommended_compensation, precision: 12, scale: 2
      t.decimal :approved_increment_percentage, precision: 5, scale: 2
      t.decimal :approved_compensation, precision: 12, scale: 2

      t.date :effective_date
      t.text :management_comments

      # §18 — its own recommendation, dates and reasoning.
      t.integer :promotion_recommendation, default: 0, null: false
      t.references :current_designation, foreign_key: { to_table: :designations }
      t.references :proposed_designation, foreign_key: { to_table: :designations }
      t.text :promotion_reason
      t.date :promotion_effective_date
      t.text :new_responsibilities

      t.timestamps
    end

    # --- In-app notifications ---------------------------------------------
    # There was no notification system at all (the bell in the frontend was an
    # explicit UI shell). Built generic rather than appraisal-specific so the
    # next feature that needs to tell someone something can reuse it.
    create_table :notifications do |t|
      t.references :company, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.string :category, null: false
      t.string :title, null: false
      t.text :body
      t.string :action_url
      t.string :notifiable_type
      t.bigint :notifiable_id
      t.datetime :read_at

      t.timestamps
    end
    add_index :notifications, [ :user_id, :read_at ]
    add_index :notifications, [ :company_id, :created_at ]
    add_index :notifications, [ :notifiable_type, :notifiable_id ]
  end
end

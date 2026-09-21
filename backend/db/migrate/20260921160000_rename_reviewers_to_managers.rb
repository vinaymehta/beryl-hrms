# Terminology correction: the typed hierarchy is a REPORTING MANAGER hierarchy,
# not a "reviewer" one —
#
#   Employee → Primary Manager → (optional) Secondary Manager → Final Manager
#
# and the feedback tables built alongside it are withdrawn. Feedback/appraisal
# is a separate future feature and has no business in the Employee model.
#
# A rename rather than a drop-and-recreate, so the assignments already made
# survive untouched.
class RenameReviewersToManagers < ActiveRecord::Migration[8.1]
  def up
    # Custom-named indexes don't follow a rename_table, so they are renamed
    # explicitly — otherwise the new table keeps indexes named after the old one.
    rename_index :employee_reviewers, "index_employee_reviewers_uniqueness", "index_employee_managers_uniqueness"
    rename_index :employee_reviewers, "index_employee_reviewers_on_company_and_reviewer", "index_employee_managers_on_company_and_manager"

    rename_table :employee_reviewers, :employee_managers
    rename_column :employee_managers, :reviewer_id, :manager_id
    rename_column :employee_managers, :reviewer_level, :manager_level

    # Withdrawn in full: no model, controller, policy, serializer or route for
    # this remains. Reinstating appraisal later starts from its own design, not
    # from a half-built table sitting inside the Employee feature.
    drop_table :reviewer_feedbacks
  end

  def down
    rename_column :employee_managers, :manager_level, :reviewer_level
    rename_column :employee_managers, :manager_id, :reviewer_id
    rename_table :employee_managers, :employee_reviewers

    rename_index :employee_reviewers, "index_employee_managers_uniqueness", "index_employee_reviewers_uniqueness"
    rename_index :employee_reviewers, "index_employee_managers_on_company_and_manager", "index_employee_reviewers_on_company_and_reviewer"

    create_table :reviewer_feedbacks do |t|
      t.references :company, null: false, foreign_key: true
      t.references :employee, null: false, foreign_key: true
      t.references :reviewer, null: false, foreign_key: { to_table: :employees }
      t.integer :reviewer_level, null: false
      t.text :body, null: false
      t.datetime :submitted_at, null: false

      t.timestamps
    end
    add_index :reviewer_feedbacks, [ :employee_id, :reviewer_level ],
              name: "index_reviewer_feedbacks_on_employee_and_level"
    add_index :reviewer_feedbacks, [ :company_id, :submitted_at ],
              name: "index_reviewer_feedbacks_on_company_and_submitted_at"
  end
end

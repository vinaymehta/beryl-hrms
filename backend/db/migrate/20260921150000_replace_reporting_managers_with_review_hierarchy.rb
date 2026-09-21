# Replaces the generic many-to-many "reporting managers" with a TYPED review
# hierarchy: Employee → Primary → (optional) Secondary → Final.
#
# The two models can't coexist — "who reviews this person" would have had two
# competing answers — so the old table is migrated and dropped in the same
# migration rather than left behind as a second source of truth.
class ReplaceReportingManagersWithReviewHierarchy < ActiveRecord::Migration[8.1]
  def up
    create_table :employee_reviewers do |t|
      t.references :company, null: false, foreign_key: true
      t.references :employee, null: false, foreign_key: true
      t.references :reviewer, null: false, foreign_key: { to_table: :employees }
      # 0 primary / 1 secondary / 2 final — see EmployeeReviewer#reviewer_level.
      t.integer :reviewer_level, null: false

      t.timestamps
    end

    # THE cardinality rule, enforced in the database and not just the model:
    # at most one primary, one secondary and one final per employee.
    add_index :employee_reviewers, [ :employee_id, :reviewer_level ],
              unique: true, name: "index_employee_reviewers_uniqueness"
    # "Who do I review?" — the reverse lookup, used by the feedback policy.
    add_index :employee_reviewers, [ :company_id, :reviewer_id ],
              name: "index_employee_reviewers_on_company_and_reviewer"

    migrate_existing_reporting_lines

    drop_table :employee_reporting_managers

    create_table :reviewer_feedbacks do |t|
      t.references :company, null: false, foreign_key: true
      t.references :employee, null: false, foreign_key: true
      t.references :reviewer, null: false, foreign_key: { to_table: :employees }
      # Denormalised from the assignment ON PURPOSE: feedback has to stay
      # attributable to the level it was given at even if the person is later
      # moved from secondary to final, or unassigned altogether.
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

  def down
    drop_table :reviewer_feedbacks

    create_table :employee_reporting_managers do |t|
      t.references :company, null: false, foreign_key: true
      t.references :employee, null: false, foreign_key: true
      t.references :manager, null: false, foreign_key: { to_table: :employees }
      t.timestamps
    end
    add_index :employee_reporting_managers, [ :employee_id, :manager_id ],
              unique: true, name: "index_employee_reporting_managers_uniqueness"
    add_index :employee_reporting_managers, [ :company_id, :manager_id ],
              name: "index_employee_reporting_managers_on_company_and_manager"

    execute <<~SQL.squish
      INSERT INTO employee_reporting_managers (company_id, employee_id, manager_id, created_at, updated_at)
      SELECT company_id, employee_id, reviewer_id, created_at, updated_at
      FROM employee_reviewers
    SQL

    drop_table :employee_reviewers
  end

  private
    # Best-effort carry-over so nobody's reporting line silently vanishes: the
    # oldest manager becomes the primary reviewer, the next the secondary. A
    # third-or-beyond manager has nowhere to go in a hierarchy that holds three
    # typed slots, and is dropped — the old model allowed unlimited managers,
    # the new one deliberately does not.
    #
    # Nothing is mapped to FINAL: that slot means "CEO or Department Head", and
    # guessing which of someone's old managers was that would be inventing data.
    def migrate_existing_reporting_lines
      execute <<~SQL.squish
        INSERT INTO employee_reviewers (company_id, employee_id, reviewer_id, reviewer_level, created_at, updated_at)
        SELECT company_id, employee_id, manager_id,
               CASE rank_in_employee WHEN 1 THEN 0 ELSE 1 END,
               created_at, updated_at
        FROM (
          SELECT company_id, employee_id, manager_id, created_at, updated_at,
                 ROW_NUMBER() OVER (PARTITION BY employee_id ORDER BY created_at, id) AS rank_in_employee
          FROM employee_reporting_managers
        ) ranked
        WHERE rank_in_employee <= 2
      SQL
    end
end

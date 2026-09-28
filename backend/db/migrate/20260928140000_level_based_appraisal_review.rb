# Review by every assigned manager level, then a Final review by Admin/HR.
#
# Before: three fixed stages — primary, secondary (optional), and a "final"
# review by the employee's 3rd-level manager. An employee without a 3rd-level
# manager reached final_review with nobody able to act on it.
#
# After: the appraisal snapshots its reviewer chain (`reviewer_ids`, level 1
# first — every assigned level, empty ones skipped) and walks it one level at
# a time in a single `manager_review` status (`review_level` says which). The
# final_review that follows belongs to Admin/HR.
#
# Existing rows are carried over in place: the old primary/secondary stages
# become manager_review levels, and reviewer_ids is built from the managers
# each appraisal already snapshotted.
class LevelBasedAppraisalReview < ActiveRecord::Migration[8.1]
  PRIMARY_REVIEW = 3
  SECONDARY_REVIEW = 4
  MANAGER_REVIEW = 11
  REV_PRIMARY = 1
  REV_SECONDARY = 2
  REV_MANAGER = 4

  def up
    add_column :appraisals, :reviewer_ids, :bigint, array: true, null: false, default: []
    add_column :appraisals, :review_level, :integer
    add_index :appraisals, :reviewer_ids, using: :gin
    add_column :appraisal_revisions, :review_level, :integer

    # The chain each appraisal already knew about, in level order, blanks
    # and repeats dropped.
    execute <<~SQL.squish
      UPDATE appraisals
      SET reviewer_ids = ARRAY(
        SELECT x FROM unnest(ARRAY[primary_manager_id, secondary_manager_id, final_manager_id])
          WITH ORDINALITY AS t(x, ord)
        WHERE x IS NOT NULL
        GROUP BY x ORDER BY MIN(ord)
      )
    SQL

    # In-flight appraisals at the old manager stages.
    execute <<~SQL.squish
      UPDATE appraisals SET status = #{MANAGER_REVIEW}, review_level = 1
      WHERE status = #{PRIMARY_REVIEW} AND cardinality(reviewer_ids) >= 1
    SQL
    execute <<~SQL.squish
      UPDATE appraisals SET status = #{MANAGER_REVIEW},
        review_level = COALESCE(array_position(reviewer_ids, secondary_manager_id), 2)
      WHERE status = #{SECONDARY_REVIEW}
    SQL

    # Past revisions: primary → level 1, secondary → level 2.
    execute "UPDATE appraisal_revisions SET stage = #{REV_MANAGER}, review_level = 1 WHERE stage = #{REV_PRIMARY}"
    execute "UPDATE appraisal_revisions SET stage = #{REV_MANAGER}, review_level = 2 WHERE stage = #{REV_SECONDARY}"
  end

  def down
    execute "UPDATE appraisal_revisions SET stage = #{REV_PRIMARY} WHERE stage = #{REV_MANAGER} AND review_level = 1"
    execute "UPDATE appraisal_revisions SET stage = #{REV_SECONDARY} WHERE stage = #{REV_MANAGER} AND review_level >= 2"
    execute "UPDATE appraisals SET status = #{PRIMARY_REVIEW} WHERE status = #{MANAGER_REVIEW} AND review_level = 1"
    execute "UPDATE appraisals SET status = #{SECONDARY_REVIEW} WHERE status = #{MANAGER_REVIEW} AND review_level >= 2"
    remove_column :appraisal_revisions, :review_level
    remove_index :appraisals, :reviewer_ids
    remove_column :appraisals, :review_level
    remove_column :appraisals, :reviewer_ids
  end
end

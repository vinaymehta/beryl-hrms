# A category whose perspective has not been decided yet.
#
# An imported workbook lists its performance perspectives in a block of their
# own and never says which of the seven areas belongs to which — so the
# importer refuses to guess (that would put a decision the company has not made
# into their template). With the column NOT NULL and defaulting to 0 there was
# nowhere for "not decided" to live: an unassigned category silently became
# "past performance", which is exactly the invented fact the importer avoids.
#
# Nullable instead. Activation still requires every category to have one —
# see AppraisalTemplate#every_category_has_a_lens — so an incomplete template
# can be saved as a draft and finished later, but never run a cycle.
class AllowNullLensOnTemplateCategories < ActiveRecord::Migration[8.1]
  def up
    change_column_null :appraisal_template_categories, :lens, true
    change_column_default :appraisal_template_categories, :lens, from: 0, to: nil
  end

  def down
    execute "UPDATE appraisal_template_categories SET lens = 0 WHERE lens IS NULL"
    change_column_default :appraisal_template_categories, :lens, from: nil, to: 0
    change_column_null :appraisal_template_categories, :lens, false
  end
end

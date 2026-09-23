# Answers to the free-text fields a TEMPLATE defines, keyed by the workbook's
# own field keys (Appraisals::TemplateImport#field_key).
#
# The six narrative columns beside this — summary, achievements, strengths,
# improvement_areas, training_needs, next_period_goals — stay exactly as they
# are. They are the fixed shape the product shipped with, every existing
# revision is written against them, and nothing here rewrites that history.
#
# They cannot, however, express a template whose fields come from a
# spreadsheet: an admin who renames "Key Strengths", adds a seventh prompt or
# drops one has no column to land in. This holds those answers without
# a migration per workbook.
class AddResponsesToAppraisalRevisions < ActiveRecord::Migration[8.1]
  def change
    add_column :appraisal_revisions, :responses, :jsonb, default: {}, null: false
  end
end

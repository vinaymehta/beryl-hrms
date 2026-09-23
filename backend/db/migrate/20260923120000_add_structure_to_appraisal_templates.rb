# The non-question parts of an imported appraisal workbook: the employee detail
# fields, the three perspectives, the development & career prompts, the final
# review fields and the rating guide.
#
# One JSONB column rather than five tables. These are DOCUMENT STRUCTURE — a
# faithful record of the form the company actually uses — not entities anything
# queries, joins or reports on. The parts the workflow really acts on already
# have real tables (categories, questions, compensation decisions), and this
# holds what would otherwise be read and thrown away.
class AddStructureToAppraisalTemplates < ActiveRecord::Migration[8.1]
  def change
    add_column :appraisal_templates, :structure, :jsonb, default: {}, null: false
  end
end

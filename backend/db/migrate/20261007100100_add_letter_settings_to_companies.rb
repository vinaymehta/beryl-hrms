# What the appraisal letter needs from the company: the legal name it is
# written on behalf of ("For Beryl Systems Private Limited"), and the salary
# rules that pre-fill the letter's compensation table at the Discussion step.
#
# Rules are stored sparse — {} until somebody changes one — and read through
# Company#salary_structure_rules, which fills the gaps from the defaults. So a
# company that never opens the setting gets the reference letter's split.
class AddLetterSettingsToCompanies < ActiveRecord::Migration[8.1]
  def change
    add_column :companies, :legal_name, :string
    add_column :companies, :salary_structure_rules, :jsonb, null: false, default: {}
  end
end

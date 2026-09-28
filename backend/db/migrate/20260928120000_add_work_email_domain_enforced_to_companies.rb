# Lets a company switch the work-email domain check off without forgetting the
# domain it had set. On by default, so every existing company keeps exactly
# the rule it has today.
class AddWorkEmailDomainEnforcedToCompanies < ActiveRecord::Migration[8.1]
  def change
    add_column :companies, :work_email_domain_enforced, :boolean, null: false, default: true
  end
end

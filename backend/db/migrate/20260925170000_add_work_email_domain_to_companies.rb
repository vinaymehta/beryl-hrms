class AddWorkEmailDomainToCompanies < ActiveRecord::Migration[8.1]
  def up
    # The domain every work email in this company must end with, e.g.
    # "berylsystems.com". Per company rather than hard-coded: this is a
    # multi-tenant app, and a constant in the code would reject every address
    # belonging to anybody but the first customer.
    #
    # NULL means "no restriction" — a company that has not set one accepts any
    # valid address, which is the only safe default for a tenant we know
    # nothing about.
    add_column :companies, :work_email_domain, :string

    # The existing tenants are Beryl's, so they get the rule the spec asks for.
    # New companies start unrestricted.
    execute(<<~SQL.squish)
      UPDATE companies SET work_email_domain = 'berylsystems.com'
    SQL
  end

  def down
    remove_column :companies, :work_email_domain
  end
end

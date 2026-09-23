require "rails_helper"

RSpec.describe Roles::SeedDefaults do
  let(:company) { create(:company) }

  def permissions_for(slug)
    ActsAsTenant.with_tenant(company) { company.roles.find_by!(slug: slug).permissions.pluck(:key) }
  end

  before { described_class.call(company) }

  # Mail in this product is the company's recruitment inbox. `mail.view` is what
  # ZohoConnectionPolicy#create_individual? checks and what puts the Mail
  # section in Settings, so granting it to employees offered every one of them
  # "Connect to mailbox" for a personal Zoho account.
  it "does not let an employee connect a mailbox" do
    expect(permissions_for("employee")).not_to include("mail.view", "mail.search")
  end

  it "leaves the employee's own work untouched" do
    expect(permissions_for("employee")).to include(
      "appraisals.submit_self", "documents.manage_own", "notifications.view"
    )
  end

  it "keeps mail with the administrator" do
    expect(permissions_for("admin")).to include("mail.view", "zoho_connections.manage")
  end

  # Re-running must not quietly re-grant what was deliberately taken away, nor
  # revert a permission set an admin has since customised.
  it "leaves an existing role's permissions alone on a second run" do
    role = ActsAsTenant.with_tenant(company) { company.roles.find_by!(slug: "employee") }
    ActsAsTenant.with_tenant(company) { role.permissions = Permission.where(key: "notifications.view") }

    described_class.call(company)

    expect(permissions_for("employee")).to eq([ "notifications.view" ])
  end
end

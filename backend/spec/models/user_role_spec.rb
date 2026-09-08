require "rails_helper"

RSpec.describe UserRole, type: :model do
  it "allows pairing a user with a role in the same company" do
    company = create(:company)
    user = ActsAsTenant.with_tenant(company) { create(:user, company: company) }
    role = ActsAsTenant.with_tenant(company) { create(:role, company: company) }

    user_role = ActsAsTenant.with_tenant(company) { UserRole.new(user: user, role: role) }

    expect(user_role).to be_valid
  end

  # The exact bug the plan calls out: nothing in the base schema stops a raw
  # role_id from params pointing a Company-A user at a Company-B role.
  it "rejects pairing a user with a role from a different company" do
    company_a = create(:company)
    company_b = create(:company)
    user = ActsAsTenant.with_tenant(company_a) { create(:user, company: company_a) }
    other_companys_role = ActsAsTenant.with_tenant(company_b) { create(:role, company: company_b) }

    user_role = ActsAsTenant.with_tenant(company_a) { UserRole.new(user: user, role: other_companys_role) }

    expect(user_role).not_to be_valid
    expect(user_role.errors[:role]).to be_present
  end
end

require "rails_helper"

# Phase 2 has no business-domain policy yet (those arrive with Phase 5's
# CRUD endpoints), so this exercises the shared same_company?/permission?
# logic every future policy is built on, via a minimal concrete subclass —
# this is the mechanism a "does an Employee-only user get denied on an
# HR-gated action" check ultimately reduces to.
RSpec.describe ApplicationPolicy do
  let(:policy_class) do
    Class.new(ApplicationPolicy) do
      def view? = permission?("employees.view")
    end
  end

  let(:company) { create(:company) }

  # Mirrors Api::V1::BaseController#set_current_tenant: a plain assignment
  # that stays in effect for the rest of the example, not a block — matches
  # how tenant context actually behaves for the remainder of a real request.
  def sign_in_as(user)
    ActsAsTenant.current_tenant = user.company
    Current.session = ActsAsTenant.with_tenant(user.company) { user.sessions.create! }
  end

  it "denies a user who lacks the permission" do
    user = ActsAsTenant.with_tenant(company) { create(:user, company: company) }
    record = ActsAsTenant.with_tenant(company) { create(:employee, company: company) }
    sign_in_as(user)

    expect(policy_class.new(user, record).view?).to be false
  end

  it "allows a user who holds the permission via a role" do
    permission = Permission.find_by!(key: "employees.view") # seeded catalog, not created fresh
    user = ActsAsTenant.with_tenant(company) { create(:user, company: company) }
    role = ActsAsTenant.with_tenant(company) { create(:role, company: company) }
    role.permissions << permission
    ActsAsTenant.with_tenant(company) { create(:user_role, user: user, role: role, company: company) }
    record = ActsAsTenant.with_tenant(company) { create(:employee, company: company) }
    sign_in_as(user)

    expect(policy_class.new(user, record).view?).to be true
  end

  it "denies even a permitted user across a company boundary" do
    other_company = create(:company)
    permission = Permission.find_by!(key: "employees.view") # seeded catalog, not created fresh
    user = ActsAsTenant.with_tenant(company) { create(:user, company: company) }
    role = ActsAsTenant.with_tenant(company) { create(:role, company: company) }
    role.permissions << permission
    ActsAsTenant.with_tenant(company) { create(:user_role, user: user, role: role, company: company) }
    other_companys_record = ActsAsTenant.with_tenant(other_company) { create(:employee, company: other_company) }
    sign_in_as(user)

    expect(policy_class.new(user, other_companys_record).view?).to be false
  end
end

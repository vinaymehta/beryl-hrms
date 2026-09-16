require "rails_helper"

RSpec.describe EmployeePolicy do
  let(:company) { create(:company) }

  def sign_in_as(user)
    Current.reset # a prior sign_in_as in the same example would otherwise leave Current.permissions memoized from the previous user
    ActsAsTenant.current_tenant = user.company
    Current.session = ActsAsTenant.with_tenant(user.company) { user.sessions.create! }
  end

  def user_with_permissions(company, *keys)
    user = ActsAsTenant.with_tenant(company) { create(:user, company: company) }
    role = ActsAsTenant.with_tenant(company) { create(:role, company: company) }
    role.permissions = Permission.where(key: keys)
    ActsAsTenant.with_tenant(company) { create(:user_role, user: user, role: role, company: company) }
    user
  end

  def resolve_for(user)
    ActsAsTenant.with_tenant(user.company) { described_class::Scope.new(user, Employee).resolve.to_a }
  end

  describe "scope" do
    # employees.view alone was enough to browse the whole company directory.
    # Someone who only looks after their own record has no business doing that.
    it "shows a plain viewer nothing but their own record" do
      user = user_with_permissions(company, "employees.view")
      own = ActsAsTenant.with_tenant(company) { create(:employee, company: company, user: user) }
      colleague = ActsAsTenant.with_tenant(company) { create(:employee, company: company) }
      sign_in_as(user)

      visible = resolve_for(user)

      expect(visible).to eq([ own ])
      expect(visible).not_to include(colleague)
    end

    it "shows everyone to a user who looks after people" do
      hr = user_with_permissions(company, "employees.view", "employees.create")
      one = ActsAsTenant.with_tenant(company) { create(:employee, company: company) }
      two = ActsAsTenant.with_tenant(company) { create(:employee, company: company) }
      sign_in_as(hr)

      expect(resolve_for(hr)).to include(one, two)
    end

    it "shows nothing to a viewer with no employee record of their own" do
      user = user_with_permissions(company, "employees.view")
      ActsAsTenant.with_tenant(company) { create(:employee, company: company) }
      sign_in_as(user)

      expect(resolve_for(user)).to be_empty
    end

    it "never reaches into another company" do
      other_company = create(:company)
      hr = user_with_permissions(company, "employees.view", "employees.create")
      outsider = ActsAsTenant.with_tenant(other_company) { create(:employee, company: other_company) }
      sign_in_as(hr)

      expect(resolve_for(hr)).not_to include(outsider)
    end
  end
end

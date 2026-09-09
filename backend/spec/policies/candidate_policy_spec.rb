require "rails_helper"

RSpec.describe CandidatePolicy do
  let(:company) { create(:company) }

  def sign_in_as(user)
    Current.reset # a prior sign_in_as in the same example would otherwise leave Current.permissions memoized from the previous user
    ActsAsTenant.current_tenant = user.company
    Current.session = ActsAsTenant.with_tenant(user.company) { user.sessions.create! }
  end

  def user_with_permission(company, key)
    permission = Permission.find_by!(key: key)
    user = ActsAsTenant.with_tenant(company) { create(:user, company: company) }
    role = ActsAsTenant.with_tenant(company) { create(:role, company: company) }
    role.permissions << permission
    ActsAsTenant.with_tenant(company) { create(:user_role, user: user, role: role, company: company) }
    user
  end

  it "denies a user with no recruitment permission" do
    user = ActsAsTenant.with_tenant(company) { create(:user, company: company) }
    candidate = ActsAsTenant.with_tenant(company) { create(:candidate, company: company) }
    sign_in_as(user)

    expect(described_class.new(user, candidate).show?).to be false
    expect(described_class.new(user, candidate).update?).to be false
  end

  it "allows show/update to a user holding the granular candidates.* permissions" do
    user = user_with_permission(company, "candidates.view")
    candidate = ActsAsTenant.with_tenant(company) { create(:candidate, company: company) }
    sign_in_as(user)

    expect(described_class.new(user, candidate).show?).to be true
    expect(described_class.new(user, candidate).update?).to be false # candidates.manage, not candidates.view, guards writes

    manager = user_with_permission(company, "candidates.manage")
    sign_in_as(manager)
    expect(described_class.new(manager, candidate).update?).to be true
    expect(described_class.new(manager, candidate).shortlist?).to be true
  end

  it "denies access across a company boundary even with the permission" do
    other_company = create(:company)
    user = user_with_permission(company, "candidates.view")
    other_candidate = ActsAsTenant.with_tenant(other_company) { create(:candidate, company: other_company) }
    sign_in_as(user)

    expect(described_class.new(user, other_candidate).show?).to be false
  end

  it "scopes the index to only the user's own company" do
    other_company = create(:company)
    user = user_with_permission(company, "candidates.view")
    mine = ActsAsTenant.with_tenant(company) { create(:candidate, company: company) }
    ActsAsTenant.with_tenant(other_company) { create(:candidate, company: other_company) }
    sign_in_as(user)

    scope = described_class::Scope.new(user, Candidate.unscoped).resolve
    expect(scope).to contain_exactly(mine)
  end
end

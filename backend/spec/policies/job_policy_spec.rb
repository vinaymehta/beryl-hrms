require "rails_helper"

RSpec.describe JobPolicy do
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

  it "denies a user with no jobs permission" do
    user = ActsAsTenant.with_tenant(company) { create(:user, company: company) }
    job = ActsAsTenant.with_tenant(company) { create(:job, company: company) }
    sign_in_as(user)

    expect(described_class.new(user, job).show?).to be false
    expect(described_class.new(user, job).create?).to be false
  end

  it "separates read (jobs.view) from manage (jobs.manage)" do
    viewer = user_with_permission(company, "jobs.view")
    job = ActsAsTenant.with_tenant(company) { create(:job, company: company) }
    sign_in_as(viewer)

    expect(described_class.new(viewer, job).show?).to be true
    expect(described_class.new(viewer, job).match_candidates?).to be true
    expect(described_class.new(viewer, job).update?).to be false

    manager = user_with_permission(company, "jobs.manage")
    sign_in_as(manager)
    expect(described_class.new(manager, job).update?).to be true
    expect(described_class.new(manager, job).destroy?).to be true
  end

  it "denies access across a company boundary even with the permission" do
    other_company = create(:company)
    user = user_with_permission(company, "jobs.view")
    other_job = ActsAsTenant.with_tenant(other_company) { create(:job, company: other_company) }
    sign_in_as(user)

    expect(described_class.new(user, other_job).show?).to be false
  end
end

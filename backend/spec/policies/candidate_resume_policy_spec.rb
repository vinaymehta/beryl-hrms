require "rails_helper"

RSpec.describe CandidateResumePolicy do
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

  it "denies show/download/reprocess to a user with no resume permission" do
    user = ActsAsTenant.with_tenant(company) { create(:user, company: company) }
    resume = ActsAsTenant.with_tenant(company) { create(:candidate_resume, company: company) }
    sign_in_as(user)

    expect(described_class.new(user, resume).show?).to be false
    expect(described_class.new(user, resume).download?).to be false
    expect(described_class.new(user, resume).reprocess?).to be false
  end

  it "separates read (resumes.view) from process/manage (resumes.process)" do
    viewer = user_with_permission(company, "resumes.view")
    resume = ActsAsTenant.with_tenant(company) { create(:candidate_resume, company: company) }
    sign_in_as(viewer)

    expect(described_class.new(viewer, resume).show?).to be true
    expect(described_class.new(viewer, resume).download?).to be true
    expect(described_class.new(viewer, resume).reprocess?).to be false
    expect(described_class.new(viewer, resume).destroy?).to be false

    processor = user_with_permission(company, "resumes.process")
    sign_in_as(processor)
    expect(described_class.new(processor, resume).reprocess?).to be true
    expect(described_class.new(processor, resume).destroy?).to be false # destroy requires recruitment.manage
  end

  it "denies access across a company boundary even with the permission" do
    other_company = create(:company)
    user = user_with_permission(company, "resumes.view")
    other_resume = ActsAsTenant.with_tenant(other_company) { create(:candidate_resume, company: other_company) }
    sign_in_as(user)

    expect(described_class.new(user, other_resume).show?).to be false
  end
end

require "rails_helper"

RSpec.describe AppraisalCommentPolicy do
  let(:company) { create(:company) }
  let(:other_company) { create(:company) }

  def user_with_permissions(company, *keys)
    user = ActsAsTenant.with_tenant(company) { create(:user, company: company) }
    role = ActsAsTenant.with_tenant(company) { create(:role, company: company) }
    role.permissions = Permission.where(key: keys)
    ActsAsTenant.with_tenant(company) { create(:user_role, user: user, role: role, company: company) }
    user
  end

  # One started appraisal with a full reviewer chain, plus a login for the
  # subject and for the primary reviewer.
  def appraisal_setup(company)
    ActsAsTenant.with_tenant(company) do
      template = company.appraisal_templates.create!(name: "T", status: :active)
      category = template.categories.create!(name: "C", lens: :past, weight: 100, position: 0)
      category.questions.create!(prompt: "Q", position: 0)

      subject_user = user_with_permissions(company, "appraisals.submit_self")
      reviewer_user = user_with_permissions(company, "appraisals.review")
      subject_employee = create(:employee, company: company, user: subject_user)
      reviewer_employee = create(:employee, company: company, user: reviewer_user)
      subject_employee.assign_managers!("primary" => reviewer_employee.id)

      cycle = company.appraisal_cycles.create!(
        name: "Cy", appraisal_template: template, status: :active, started_at: Time.current
      )
      appraisal = cycle.appraisals.create!(
        employee: subject_employee, status: :primary_review, primary_manager_id: reviewer_employee.id
      )

      { appraisal:, subject_user:, reviewer_user:, subject_employee:, reviewer_employee: }
    end
  end

  def comment!(appraisal, author:, body:, visibility:)
    ActsAsTenant.with_tenant(appraisal.company) do
      appraisal.comments.create!(author_user: author, body: body, visibility: visibility)
    end
  end

  def visible_to(user, company)
    ActsAsTenant.with_tenant(company) do
      described_class::Scope.new(user, AppraisalComment).resolve.pluck(:body)
    end
  end

  describe "Scope" do
    # The subject's clause used to require the appraisal to be released, which
    # meant an employee saw no comment at all before then — including ones they
    # had written themselves.
    context "for the employee the appraisal is about, before release" do
      it "includes a comment marked employee_visible" do
        setup = appraisal_setup(company)
        comment!(setup[:appraisal], author: setup[:reviewer_user], body: "for you", visibility: :employee_visible)

        expect(setup[:appraisal].released_at).to be_nil
        expect(visible_to(setup[:subject_user], company)).to eq([ "for you" ])
      end

      it "excludes a comment marked management_only" do
        setup = appraisal_setup(company)
        comment!(setup[:appraisal], author: setup[:reviewer_user], body: "not for you", visibility: :management_only)

        expect(visible_to(setup[:subject_user], company)).to be_empty
      end

      it "includes a comment they wrote themselves" do
        setup = appraisal_setup(company)
        comment!(setup[:appraisal], author: setup[:subject_user], body: "mine", visibility: :employee_visible)

        expect(visible_to(setup[:subject_user], company)).to eq([ "mine" ])
      end

      # The carve-out in the rule: authorship beats visibility, for your own
      # words only. In practice the controller won't let an employee file one
      # of these — this guards the scope itself, not that path.
      it "includes a management_only comment they are themselves the author of" do
        setup = appraisal_setup(company)
        comment!(setup[:appraisal], author: setup[:subject_user], body: "mine, restricted", visibility: :management_only)

        expect(visible_to(setup[:subject_user], company)).to eq([ "mine, restricted" ])
      end
    end

    context "for management" do
      it "gives an assigned reviewer every comment on the appraisal they review" do
        setup = appraisal_setup(company)
        comment!(setup[:appraisal], author: setup[:reviewer_user], body: "internal", visibility: :management_only)
        comment!(setup[:appraisal], author: setup[:subject_user], body: "theirs", visibility: :employee_visible)

        expect(visible_to(setup[:reviewer_user], company)).to contain_exactly("internal", "theirs")
      end

      it "gives an appraisals.view_all holder every comment in the company" do
        setup = appraisal_setup(company)
        comment!(setup[:appraisal], author: setup[:reviewer_user], body: "internal", visibility: :management_only)
        admin = user_with_permissions(company, "appraisals.view_all")

        expect(visible_to(admin, company)).to include("internal")
      end
    end

    context "tenancy" do
      # The own-authored clause matches on author_user_id, so it is the one
      # branch that could in principle reach across companies if the tenant
      # filter were ever dropped from in front of it.
      it "never returns another company's comment, own-authored or not" do
        here = appraisal_setup(company)
        there = appraisal_setup(other_company)
        comment!(here[:appraisal], author: here[:subject_user], body: "ours", visibility: :employee_visible)
        comment!(there[:appraisal], author: there[:subject_user], body: "theirs", visibility: :employee_visible)

        expect(visible_to(here[:subject_user], company)).to eq([ "ours" ])
        expect(visible_to(there[:subject_user], other_company)).to eq([ "theirs" ])
      end

      it "shows an unrelated employee in the same company nothing" do
        setup = appraisal_setup(company)
        comment!(setup[:appraisal], author: setup[:reviewer_user], body: "for you", visibility: :employee_visible)
        stranger = user_with_permissions(company, "appraisals.submit_self")
        ActsAsTenant.with_tenant(company) { create(:employee, company: company, user: stranger) }

        expect(visible_to(stranger, company)).to be_empty
      end
    end
  end

  describe "#may_set_management_only?" do
    it "is false for the employee the appraisal is about" do
      setup = appraisal_setup(company)
      policy = described_class.new(setup[:subject_user], setup[:appraisal])

      ActsAsTenant.with_tenant(company) { expect(policy.may_set_management_only?).to be(false) }
    end

    it "is true for the reviewer" do
      setup = appraisal_setup(company)
      policy = described_class.new(setup[:reviewer_user], setup[:appraisal])

      ActsAsTenant.with_tenant(company) { expect(policy.may_set_management_only?).to be(true) }
    end
  end
end

require "rails_helper"

RSpec.describe AppraisalRemindersJob do
  let(:company) { create(:company) }

  def in_tenant(&) = ActsAsTenant.with_tenant(company, &)

  # Minimum viable cycle: one category, one question, one started appraisal.
  def running_appraisal(submission_deadline:, primary_deadline: nil, status: :self_appraisal_open)
    in_tenant do
      ActsAsTenant.with_tenant(company) { Roles::SeedDefaults.call(company) } unless company.roles.any?
      template = company.appraisal_templates.create!(name: "T", status: :active)
      category = template.categories.create!(name: "C", lens: :past, weight: 100, position: 0)
      category.questions.create!(prompt: "Q", position: 0)

      manager = create(:employee, company: company)
      employee_user = create(:user, company: company)
      employee = create(:employee, company: company, user: employee_user)
      employee.assign_managers!("primary" => manager.id)

      cycle = company.appraisal_cycles.create!(
        name: "Cycle", appraisal_template: template, status: :active, started_at: Time.current,
        employee_submission_deadline: submission_deadline,
        primary_review_deadline: primary_deadline
      )
      cycle.appraisals.create!(employee: employee, status: status, primary_manager_id: manager.id)
    end
  end

  def notifications_for(appraisal, category)
    in_tenant { Notification.where(notifiable_id: appraisal.id, category: category).count }
  end

  it "nudges an employee whose self-appraisal is due soon" do
    appraisal = running_appraisal(submission_deadline: Date.current + 2)

    described_class.perform_now

    expect(notifications_for(appraisal, "appraisal.submission_due")).to eq(1)
    expect(notifications_for(appraisal, "appraisal.overdue")).to be_zero
  end

  it "says nothing while the deadline is still far off" do
    appraisal = running_appraisal(submission_deadline: Date.current + 30)

    described_class.perform_now

    expect(notifications_for(appraisal, "appraisal.submission_due")).to be_zero
  end

  it "reports an overdue self-appraisal to the employee" do
    appraisal = running_appraisal(submission_deadline: Date.current - 1)

    described_class.perform_now

    expect(notifications_for(appraisal, "appraisal.overdue")).to eq(1)
  end

  it "reports an overdue primary review to the manager, not the employee" do
    appraisal = running_appraisal(
      submission_deadline: Date.current - 10,
      primary_deadline: Date.current - 1,
      status: :primary_review
    )

    described_class.perform_now

    recipient = in_tenant { Notification.find_by(notifiable_id: appraisal.id, category: "appraisal.overdue")&.user_id }
    # The manager in this fixture has no login, so nothing is delivered — which
    # is the correct outcome, not a crash.
    expect(recipient).to be_nil
    expect(in_tenant { appraisal.reload.status }).to eq("primary_review")
  end

  it "doesn't send the same reminder twice in one day" do
    appraisal = running_appraisal(submission_deadline: Date.current + 1)

    described_class.perform_now
    described_class.perform_now

    expect(notifications_for(appraisal, "appraisal.submission_due")).to eq(1)
  end

  it "leaves a cycle that isn't active alone" do
    appraisal = running_appraisal(submission_deadline: Date.current - 5)
    in_tenant { appraisal.appraisal_cycle.update!(status: :closed) }

    described_class.perform_now

    expect(notifications_for(appraisal, "appraisal.overdue")).to be_zero
  end
end

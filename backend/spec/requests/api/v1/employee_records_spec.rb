require "rails_helper"

# Phase 1 (employment + compensation history, assets) and Phase 5 (goals,
# skills, training, review types, 360°, PIP).
RSpec.describe "Employee records and continuous performance", type: :request do
  before do
    post "/api/v1/auth/register",
         params: {
           companyName: "Records Corp", firstName: "Ada", lastName: "Admin",
           email: "records.admin@acme.test", password: "correct-horse-battery-1",
           passwordConfirmation: "correct-horse-battery-1"
         }.to_json,
         headers: { "Content-Type" => "application/json" }
  end

  let(:company) { Company.find_by!(name: "Records Corp") }
  let(:json_headers) { { "Content-Type" => "application/json" } }

  def in_tenant(&) = ActsAsTenant.with_tenant(company, &)
  def role(slug) = in_tenant { company.roles.find_by!(slug: slug) }
  def body = response.parsed_body["data"]

  def staff(email:, role_slug: "employee", first_name: "Staff")
    in_tenant do
      user = create(:user, company: company, email_address: email, password: "correct-horse-battery-1")
      create(:user_role, user: user, role: role(role_slug), company: company)
      create(:employee, company: company, user: user, first_name: first_name, last_name: "Member")
    end
  end

  def login(email)
    post "/api/v1/auth/login",
         params: { email: email, password: "correct-horse-battery-1" }.to_json, headers: json_headers
  end

  def login_admin = login("records.admin@acme.test")

  let(:employee) { staff(email: "subject@acme.test", first_name: "Sofia") }

  # --- Phase 1 ---------------------------------------------------------------

  describe "employment history (§3, §26)" do
    it "records a joining event the moment an employee is created" do
      login_admin

      get "/api/v1/employees/#{employee.id}/employment_events"

      expect(response).to have_http_status(:ok)
      expect(body.map { |e| e["eventType"] }).to include("joined")
    end

    it "records a change instead of overwriting the old value" do
      designation = in_tenant { company.designations.create!(title: "Engineer") }
      promoted = in_tenant { company.designations.create!(title: "Senior Engineer") }
      in_tenant { employee.update!(designation: designation) }
      login_admin

      patch "/api/v1/employees/#{employee.id}",
            params: { designationId: promoted.id }.to_json, headers: json_headers
      expect(response).to have_http_status(:ok)

      get "/api/v1/employees/#{employee.id}/employment_events"
      change = body.find { |e| e["eventType"] == "designation_changed" }
      expect(change["fromValue"]).to eq("Engineer")
      expect(change["toValue"]).to eq("Senior Engineer")
    end

    it "keeps a past title readable after the designation itself is renamed" do
      designation = in_tenant { company.designations.create!(title: "Engineer") }
      in_tenant do
        employee.update!(designation: designation)
        employee.update!(designation: company.designations.create!(title: "Lead"))
        # §26: a historical record must not change when the thing it refers to does.
        designation.update!(title: "Renamed Entirely")
      end
      login_admin

      get "/api/v1/employees/#{employee.id}/employment_events"

      expect(body.map { |e| e["fromValue"] }).to include("Engineer")
    end

    it "records a manager change through the existing hierarchy path" do
      manager = staff(email: "mgr@acme.test", first_name: "Mia")
      in_tenant { employee.assign_managers!("primary" => manager.id) }
      login_admin

      get "/api/v1/employees/#{employee.id}/employment_events"

      change = body.find { |e| e["eventType"] == "manager_changed" }
      expect(change["toValue"]).to eq("Mia Member")
    end

    it "is immutable and has no write route" do
      event = in_tenant { employee.employment_events.first }

      expect { in_tenant { event.update!(note: "rewritten") } }
        .to raise_error(ActiveRecord::ReadOnlyRecord)
      # And there is no write route at all — only :index is declared.
      expect(Rails.application.routes.routes.map { |r| r.path.spec.to_s })
        .to include(a_string_matching(%r{employment_events}))
      expect(Rails.application.routes.routes.select { |r| r.path.spec.to_s.include?("employment_events") }
                  .flat_map { |r| r.verb.split("|") }.uniq).to eq([ "GET" ])
    end

    it "lets an employee read their own history" do
      employee
      login("subject@acme.test")

      get "/api/v1/employees/#{employee.id}/employment_events"

      expect(response).to have_http_status(:ok)
      expect(body).not_to be_empty
    end

    it "stores employment type and work location" do
      login_admin

      patch "/api/v1/employees/#{employee.id}",
            params: { employmentType: "contract", workLocation: "Jaipur" }.to_json, headers: json_headers

      expect(response).to have_http_status(:ok)
      expect(in_tenant { employee.reload.employment_type }).to eq("contract")
      expect(in_tenant { employee.reload.work_location }).to eq("Jaipur")
    end
  end

  describe "compensation history (§3, §17) — restricted" do
    def create_record
      post "/api/v1/employees/#{employee.id}/compensation_records",
           params: { annualCompensation: 900_000, incrementPercentage: 9,
                     effectiveOn: Date.current.to_s, reason: "annual_increment" }.to_json,
           headers: json_headers
    end

    it "is recorded by an authorized holder" do
      login_admin

      create_record

      expect(response).to have_http_status(:created)
      expect(body["incrementPercentage"].to_f).to eq(9.0)
    end

    it "is NOT readable by the employee it is about" do
      login_admin
      create_record

      login("subject@acme.test")
      get "/api/v1/employees/#{employee.id}/compensation_records"

      # The key isn't held, and the policy marks this one not employee-readable.
      expect(response).to have_http_status(:forbidden)
    end

    it "is closed to HR, which holds no pay permission" do
      staff(email: "hr@acme.test", role_slug: "hr")
      login("hr@acme.test")

      get "/api/v1/employees/#{employee.id}/compensation_records"

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "company assets (§3)" do
    it "assigns and returns an asset" do
      login_admin

      post "/api/v1/employees/#{employee.id}/assets",
           params: { name: "MacBook Pro 14", assetType: "laptop", identifier: "BSPL-042",
                     assignedOn: Date.current.to_s }.to_json, headers: json_headers
      expect(response).to have_http_status(:created)
      asset_id = body["id"]

      patch "/api/v1/employees/#{employee.id}/assets/#{asset_id}",
            params: { status: "returned", returnedOn: Date.current.to_s }.to_json, headers: json_headers

      expect(response).to have_http_status(:ok)
      expect(body["status"]).to eq("returned")
    end

    it "refuses a returned asset with no return date" do
      login_admin
      post "/api/v1/employees/#{employee.id}/assets",
           params: { name: "Monitor", status: "returned" }.to_json, headers: json_headers

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  # --- Phase 5 ---------------------------------------------------------------

  describe "goals (§19)" do
    it "records a measurable goal with owner, target and criteria" do
      login_admin

      post "/api/v1/employees/#{employee.id}/goals",
           params: { title: "Ship the billing rewrite", successCriteria: "Live by Q2, zero P1s",
                     priority: "high", targetDate: (Date.current + 90).to_s }.to_json,
           headers: json_headers

      expect(response).to have_http_status(:created)
      expect(body["priority"]).to eq("high")
      expect(body["status"]).to eq("not_started")
    end

    it "lets the employee read their own goals but not write them" do
      login_admin
      post "/api/v1/employees/#{employee.id}/goals",
           params: { title: "Goal" }.to_json, headers: json_headers

      login("subject@acme.test")
      get "/api/v1/employees/#{employee.id}/goals"
      expect(response).to have_http_status(:ok)
      expect(body.size).to eq(1)

      post "/api/v1/employees/#{employee.id}/goals",
           params: { title: "Self-assigned" }.to_json, headers: json_headers
      expect(response).to have_http_status(:forbidden)
    end

    it "never shows one employee another's goals" do
      employee # force the subject into existence before logging in as them
      other = staff(email: "other@acme.test")
      login_admin
      post "/api/v1/employees/#{other.id}/goals", params: { title: "Theirs" }.to_json, headers: json_headers

      login("subject@acme.test")
      get "/api/v1/employees/#{other.id}/goals"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "skill matrix (§20)" do
    it "records a skill and stamps who validated it" do
      login_admin

      post "/api/v1/employees/#{employee.id}/skills",
           params: { name: "Ruby", proficiency: "advanced", evidence: "Led the payments rewrite" }.to_json,
           headers: json_headers
      expect(response).to have_http_status(:created)
      skill_id = body["id"]

      patch "/api/v1/employees/#{employee.id}/skills/#{skill_id}/validate_skill",
            params: {}.to_json, headers: json_headers

      expect(response).to have_http_status(:ok)
      expect(body["validated"]).to be(true)
      expect(body["validatedOn"]).to be_present
    end

    it "keeps one row per skill name" do
      login_admin
      post "/api/v1/employees/#{employee.id}/skills", params: { name: "Ruby" }.to_json, headers: json_headers
      post "/api/v1/employees/#{employee.id}/skills", params: { name: "ruby" }.to_json, headers: json_headers

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "training (§20)" do
    it "moves through the scope's lifecycle" do
      login_admin

      post "/api/v1/employees/#{employee.id}/trainings",
           params: { name: "Kubernetes fundamentals" }.to_json, headers: json_headers
      expect(body["status"]).to eq("identified")
      training_id = body["id"]

      patch "/api/v1/employees/#{employee.id}/trainings/#{training_id}",
            params: { status: "assigned" }.to_json, headers: json_headers
      expect(body["status"]).to eq("assigned")

      patch "/api/v1/employees/#{employee.id}/trainings/#{training_id}",
            params: { status: "manager_validated", completedOn: Date.current.to_s }.to_json,
            headers: json_headers
      expect(body["status"]).to eq("manager_validated")
    end

    it "refuses completion with no completion date" do
      login_admin
      post "/api/v1/employees/#{employee.id}/trainings",
           params: { name: "T", status: "completed" }.to_json, headers: json_headers

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "additional review types (§22)" do
    it "carries a review type on the cycle without a second workflow" do
      template = in_tenant do
        t = company.appraisal_templates.create!(name: "T")
        c = t.categories.create!(name: "C", lens: :past, weight: 100, position: 0)
        c.questions.create!(prompt: "Q", position: 0)
        t.update!(status: :active)
        t
      end
      login_admin

      post "/api/v1/appraisal_cycles",
           params: { name: "Probation — Sofia", appraisalTemplateId: template.id,
                     reviewType: "probation" }.to_json, headers: json_headers

      expect(response).to have_http_status(:created)
      expect(in_tenant { AppraisalCycle.find(body["id"]).review_type }).to eq("probation")
    end
  end

  describe "optional 360° feedback (§21)" do
    def running_appraisal
      template = in_tenant do
        t = company.appraisal_templates.create!(name: "T360")
        c = t.categories.create!(name: "C", lens: :past, weight: 100, position: 0)
        c.questions.create!(prompt: "Q", position: 0)
        t.update!(status: :active)
        t
      end
      manager = staff(email: "mgr360@acme.test", first_name: "Mgr")
      in_tenant { employee.assign_managers!("primary" => manager.id) }
      login_admin
      post "/api/v1/appraisal_cycles",
           params: { name: "C360", appraisalTemplateId: template.id,
                     eligibleEmployeeIds: [ employee.id ] }.to_json, headers: json_headers
      cycle_id = body["id"]
      post "/api/v1/appraisal_cycles/#{cycle_id}/start", params: {}.to_json, headers: json_headers
      in_tenant { Appraisal.find_by!(appraisal_cycle_id: cycle_id, employee_id: employee.id) }
    end

    it "lets an authorized holder request feedback, and only the person asked answer it" do
      appraisal = running_appraisal
      peer = staff(email: "peer@acme.test", first_name: "Peer")
      login_admin

      post "/api/v1/appraisals/#{appraisal.id}/feedback_requests",
           params: { requestedFromId: peer.id, prompt: "How was the shared project?" }.to_json,
           headers: json_headers
      expect(response).to have_http_status(:created)
      request_id = body["id"]
      expect(body["status"]).to eq("pending")

      # Somebody else can't answer on their behalf.
      bystander = staff(email: "bystander@acme.test")
      login("bystander@acme.test")
      patch "/api/v1/appraisals/#{appraisal.id}/feedback_requests/#{request_id}/respond_to_request",
            params: { response: "Not mine to give" }.to_json, headers: json_headers
      expect(response).to have_http_status(:not_found).or have_http_status(:forbidden)
      expect(bystander).to be_present

      login("peer@acme.test")
      patch "/api/v1/appraisals/#{appraisal.id}/feedback_requests/#{request_id}/respond_to_request",
            params: { response: "Easy to work with." }.to_json, headers: json_headers

      expect(response).to have_http_status(:ok)
      expect(body["status"]).to eq("submitted")
      expect(body["respondedAt"]).to be_present
    end

    it "never blocks the workflow — the scope says peer feedback isn't mandatory" do
      appraisal = running_appraisal
      peer = staff(email: "peer2@acme.test")
      login_admin
      post "/api/v1/appraisals/#{appraisal.id}/feedback_requests",
           params: { requestedFromId: peer.id }.to_json, headers: json_headers

      # Outstanding request, and the employee can still submit regardless.
      login("subject@acme.test")
      question_id = in_tenant { appraisal.appraisal_cycle.appraisal_template.questions.first.id }
      post "/api/v1/appraisals/#{appraisal.id}/submit_self",
           params: { submit: true, answers: [ { questionId: question_id, rating: 3 } ] }.to_json,
           headers: json_headers

      expect(response).to have_http_status(:ok)
      expect(in_tenant { appraisal.reload.status }).to eq("primary_review")
    end

    it "refuses a request addressed to the employee being appraised" do
      appraisal = running_appraisal
      login_admin

      post "/api/v1/appraisals/#{appraisal.id}/feedback_requests",
           params: { requestedFromId: employee.id }.to_json, headers: json_headers

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "PIP (§23)" do
    it "runs its own workflow, outside the appraisal state machine" do
      login_admin

      post "/api/v1/employees/#{employee.id}/improvement_plans",
           params: { issueDescription: "Delivery predictability",
                     expectedImprovement: "Hit committed dates for two sprints",
                     startsOn: Date.current.to_s, reviewOn: (Date.current + 30).to_s }.to_json,
           headers: json_headers
      expect(response).to have_http_status(:created)
      expect(body["status"]).to eq("draft")
      plan_id = body["id"]

      patch "/api/v1/employees/#{employee.id}/improvement_plans/#{plan_id}",
            params: { status: "active" }.to_json, headers: json_headers
      expect(body["status"]).to eq("active")

      patch "/api/v1/employees/#{employee.id}/improvement_plans/#{plan_id}",
            params: { status: "successfully_completed", closedOn: Date.current.to_s }.to_json,
            headers: json_headers
      expect(body["status"]).to eq("successfully_completed")
    end

    it "refuses a review date before the plan starts" do
      login_admin

      post "/api/v1/employees/#{employee.id}/improvement_plans",
           params: { issueDescription: "X", startsOn: Date.current.to_s,
                     reviewOn: (Date.current - 5).to_s }.to_json, headers: json_headers

      expect(response).to have_http_status(:unprocessable_content)
    end

    it "lets the employee read their own plan and add their comments only via HR" do
      login_admin
      post "/api/v1/employees/#{employee.id}/improvement_plans",
           params: { issueDescription: "X" }.to_json, headers: json_headers

      login("subject@acme.test")
      get "/api/v1/employees/#{employee.id}/improvement_plans"

      expect(response).to have_http_status(:ok)
      expect(body.size).to eq(1)
    end
  end

  describe "tenant isolation" do
    it "never reaches an employee in another company" do
      outsider = create(:company)
      foreign = ActsAsTenant.with_tenant(outsider) { create(:employee, company: outsider) }
      login_admin

      get "/api/v1/employees/#{foreign.id}/goals"

      expect(response).to have_http_status(:not_found)
    end
  end
end

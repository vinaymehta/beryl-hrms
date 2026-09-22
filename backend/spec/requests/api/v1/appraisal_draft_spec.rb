require "rails_helper"

# The step-by-step self-appraisal saves as the employee goes, so what a save
# does — and does NOT — matters more than it used to:
#
#   • a draft is mutable, unversioned and private to its author;
#   • a submission is an immutable, numbered revision;
#   • and the reviewer's read-only reference must be what was SUBMITTED, never
#     a half-finished draft that happened to be written first.
RSpec.describe "Api::V1::Appraisals self-appraisal draft", type: :request do
  before do
    post "/api/v1/auth/register",
         params: {
           companyName: "Draft Corp", firstName: "Ada", lastName: "Admin",
           email: "draft.admin@acme.test", password: "correct-horse-battery-1",
           passwordConfirmation: "correct-horse-battery-1"
         }.to_json,
         headers: { "Content-Type" => "application/json" }
  end

  let(:company) { Company.find_by!(name: "Draft Corp") }
  let(:json_headers) { { "Content-Type" => "application/json" } }

  def in_tenant(&) = ActsAsTenant.with_tenant(company, &)
  def body = response.parsed_body["data"]

  def staff(email:, first_name:, last_name:)
    in_tenant do
      user = create(:user, company: company, email_address: email, password: "correct-horse-battery-1")
      create(:user_role, user: user, role: company.roles.find_by!(slug: "employee"), company: company)
      create(:employee, company: company, user: user, first_name: first_name, last_name: last_name)
    end
  end

  def login(email)
    post "/api/v1/auth/login",
         params: { email: email, password: "correct-horse-battery-1" }.to_json, headers: json_headers
  end

  let!(:setup) do
    template = in_tenant do
      t = company.appraisal_templates.create!(name: "Annual Review")
      past = t.categories.create!(name: "Delivery", lens: :past, weight: 60, position: 0)
      future = t.categories.create!(name: "Growth", lens: :future_readiness, weight: 40, position: 1)
      past.questions.create!(prompt: "Met commitments", position: 0)
      future.questions.create!(prompt: "Ready for more scope", position: 0)
      t.update!(status: :active)
      t
    end

    primary = staff(email: "primary@acme.test", first_name: "Pat", last_name: "Primary")
    final = staff(email: "final@acme.test", first_name: "Fin", last_name: "Final")
    subject_employee = staff(email: "subject@acme.test", first_name: "Sofia", last_name: "Subject")
    in_tenant { subject_employee.assign_managers!("primary" => primary.id, "final" => final.id) }

    login("draft.admin@acme.test")
    post "/api/v1/appraisal_cycles",
         params: { name: "FY26", appraisalTemplateId: template.id, eligibleEmployeeIds: [ subject_employee.id ] }.to_json,
         headers: json_headers
    cycle_id = body["id"]
    post "/api/v1/appraisal_cycles/#{cycle_id}/start", params: {}.to_json, headers: json_headers

    { template:, appraisal: in_tenant { Appraisal.find_by!(appraisal_cycle_id: cycle_id) } }
  end

  let(:appraisal) { setup[:appraisal] }
  let(:questions) { in_tenant { setup[:template].questions.order(:id).pluck(:id) } }

  def save_draft(answers:, step: 1, narrative: {})
    patch "/api/v1/appraisals/#{appraisal.id}/save_draft",
          params: { step: step, answers: answers, **narrative }.to_json, headers: json_headers
  end

  def submit_self(ratings:)
    post "/api/v1/appraisals/#{appraisal.id}/submit_self",
         params: {
           summary: "My year.",
           answers: questions.each_with_index.map { |qid, i| { questionId: qid, rating: ratings[i], comment: "Evidence #{i}" } }
         }.to_json, headers: json_headers
  end

  describe "saving as the employee moves through the steps" do
    before { login("subject@acme.test") }

    it "saves work in progress without creating a version" do
      expect {
        save_draft(step: 1, answers: [ { questionId: questions.first, rating: 3, comment: "Half done" } ])
      }.not_to change { in_tenant { appraisal.revisions.count } }

      expect(response).to have_http_status(:ok)
      expect(body["selfAppraisalDraft"]["step"]).to eq(1)
      expect(body["selfAppraisalDraft"]["answers"].size).to eq(1)
      expect(appraisal.reload.status).to eq("self_appraisal_open")
    end

    it "overwrites rather than accumulating, however many steps are saved" do
      save_draft(step: 1, answers: [ { questionId: questions.first, rating: 2, comment: "First pass" } ])
      save_draft(step: 2, answers: questions.map { |qid| { questionId: qid, rating: 4, comment: "Reconsidered" } },
                 narrative: { summary: "Draft summary" })
      save_draft(step: 3, answers: questions.map { |qid| { questionId: qid, rating: 5, comment: "Final thinking" } })

      expect(in_tenant { appraisal.revisions.count }).to eq(0)
      draft = body["selfAppraisalDraft"]
      expect(draft["step"]).to eq(3)
      expect(draft["answers"].map { |a| a["rating"] }).to eq([ 5, 5 ])
    end

    it "comes back on reload, so the employee resumes where they stopped" do
      save_draft(step: 2, answers: [ { questionId: questions.last, rating: 4, comment: "Where I got to" } ],
                 narrative: { summary: "Partly written" })

      get "/api/v1/appraisals/#{appraisal.id}"

      expect(body["selfAppraisalDraft"]["narrative"]["summary"]).to eq("Partly written")
      expect(body["selfAppraisalDraft"]["answers"].first["comment"]).to eq("Where I got to")
      expect(body["selfAppraisalDraft"]["savedAt"]).to be_present
    end

    it "is cleared by the real submission, so stale text can't reappear" do
      save_draft(step: 1, answers: [ { questionId: questions.first, rating: 1, comment: "Abandoned wording" } ])

      submit_self(ratings: [ 4, 5 ])

      expect(response).to have_http_status(:ok)
      expect(body["selfAppraisalDraft"]).to be_nil
      expect(in_tenant { appraisal.reload.self_appraisal_draft }).to eq({})
    end

    it "stops being editable once the appraisal has moved on" do
      submit_self(ratings: [ 4, 5 ])

      save_draft(step: 1, answers: [ { questionId: questions.first, rating: 5, comment: "Second thoughts" } ])

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "who can see a draft" do
    it "is not sent to the manager reviewing the appraisal" do
      login("subject@acme.test")
      save_draft(step: 1, answers: [ { questionId: questions.first, rating: 1, comment: "Private wording" } ])
      submit_self(ratings: [ 4, 5 ])

      login("primary@acme.test")
      get "/api/v1/appraisals/#{appraisal.id}"

      expect(response).to have_http_status(:ok)
      expect(body["selfAppraisalDraft"]).to be_nil
      expect(response.body).not_to include("Private wording")
    end

    it "is not sent to an administrator either" do
      login("subject@acme.test")
      save_draft(step: 1, answers: [ { questionId: questions.first, rating: 1, comment: "Private wording" } ])

      login("draft.admin@acme.test")
      get "/api/v1/appraisals/#{appraisal.id}"

      expect(body["selfAppraisalDraft"]).to be_nil
    end

    it "can't be written by anyone but the employee themselves" do
      login("primary@acme.test")

      save_draft(step: 1, answers: [ { questionId: questions.first, rating: 5, comment: "Not mine to write" } ])

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "what the reviewer reads" do
    # The bug this guards: "save draft" used to create a revision, and the
    # reviewer's reference is the FIRST self_appraisal revision — so a manager
    # was shown an abandoned draft instead of the real submission.
    it "shows the submitted self-appraisal, never an earlier draft" do
      login("subject@acme.test")
      save_draft(step: 1, answers: questions.map { |qid| { questionId: qid, rating: 1, comment: "Rough first pass" } })
      submit_self(ratings: [ 4, 5 ])

      login("primary@acme.test")
      get "/api/v1/appraisals/#{appraisal.id}"

      self_revisions = body["revisions"].select { |r| r["stage"] == "self_appraisal" }
      expect(self_revisions.size).to eq(1)
      expect(self_revisions.first["versionNumber"]).to eq(1)
      expect(self_revisions.first["answers"].map { |a| a["rating"] }).to eq([ 4, 5 ])
    end
  end

  describe "the version history a final reviewer reads" do
    it "keeps every version separate, immutable and attributed" do
      login("subject@acme.test")
      submit_self(ratings: [ 4, 5 ])

      login("primary@acme.test")
      post "/api/v1/appraisals/#{appraisal.id}/submit_review",
           params: { summary: "Primary view.",
                     answers: questions.map { |qid| { questionId: qid, rating: 3, comment: "Manager evidence" } } }.to_json,
           headers: json_headers

      login("final@acme.test")
      post "/api/v1/appraisals/#{appraisal.id}/submit_review",
           params: { summary: "Final view.",
                     answers: questions.map { |qid| { questionId: qid, rating: 4, comment: "Calibrated" } } }.to_json,
           headers: json_headers

      get "/api/v1/appraisals/#{appraisal.id}"

      versions = body["revisions"].sort_by { |r| r["versionNumber"] }
      expect(versions.map { |r| r["versionNumber"] }).to eq([ 1, 2, 3 ])
      expect(versions.map { |r| r["stage"] }).to eq(%w[self_appraisal primary_review final_review])
      expect(versions.map { |r| r["label"] }).to eq(%w[V1 V2 V3])
      expect(versions.map { |r| r["authorName"] }).to eq([ "Sofia Subject", "Pat Primary", "Fin Final" ])
      expect(versions.map { |r| r["submittedAt"] }).to all(be_present)

      # Each version keeps its OWN ratings — V2 does not restate V1's.
      expect(versions[0]["answers"].map { |a| a["rating"] }).to eq([ 4, 5 ])
      expect(versions[1]["answers"].map { |a| a["rating"] }).to eq([ 3, 3 ])
      expect(versions[2]["answers"].map { |a| a["rating"] }).to eq([ 4, 4 ])
    end

    it "adds a further version after a correction instead of rewriting one" do
      login("subject@acme.test")
      submit_self(ratings: [ 4, 5 ])

      login("primary@acme.test")
      patch "/api/v1/appraisals/#{appraisal.id}/return_for_correction",
            params: { notes: "Please add evidence." }.to_json, headers: json_headers

      login("subject@acme.test")
      submit_self(ratings: [ 3, 3 ])

      login("final@acme.test")
      get "/api/v1/appraisals/#{appraisal.id}"

      self_versions = body["revisions"].select { |r| r["stage"] == "self_appraisal" }.sort_by { |r| r["versionNumber"] }
      expect(self_versions.map { |r| r["versionNumber"] }).to eq([ 1, 2 ])
      expect(self_versions[0]["answers"].map { |a| a["rating"] }).to eq([ 4, 5 ])
      expect(self_versions[1]["answers"].map { |a| a["rating"] }).to eq([ 3, 3 ])
    end
  end
end

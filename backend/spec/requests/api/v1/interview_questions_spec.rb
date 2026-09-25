require "rails_helper"

# AI-written interview questions for a shortlisted candidate.
#
# Two endpoints deliberately split by cost: GET is free and never calls the
# provider, POST spends a call and overwrites what the last interviewer saw. So
# they are authorized differently, and the tests say which is which.
RSpec.describe "Api::V1::Recruitment interview questions", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  let(:json_headers) { { "Content-Type" => "application/json" } }
  let(:company) { Company.find_by!(name: "Hiring Corp") }
  let(:password) { "correct-horse-battery-1" }

  def in_tenant(&) = ActsAsTenant.with_tenant(company, &)
  def body = response.parsed_body["data"]
  def errors = response.parsed_body["errors"]

  before do
    post "/api/v1/auth/register",
         params: {
           companyName: "Hiring Corp", firstName: "Ada", lastName: "Admin",
           email: "hiring.admin@acme.test", password: password, passwordConfirmation: password
         }.to_json, headers: json_headers
  end

  def login(email) = post("/api/v1/auth/login", params: { email: email, password: password }.to_json, headers: json_headers)
  def login_admin = login("hiring.admin@acme.test")

  let!(:candidate) do
    in_tenant do
      c = Candidate.create!(
        company: company, full_name: "Priya Raman", email: "priya@example.com",
        current_role: "Senior Software Engineer", experience_years: 6,
        highest_qualification: "B.Tech", status: :shortlisted
      )
      c.candidate_skills.create!(company: company, name: "Ruby")
      c.candidate_experiences.create!(company: company, job_title: "Engineer", company_name: "Northwind")
      c
    end
  end

  def generate(**params)
    post "/api/v1/recruitment/candidates/#{candidate.id}/interview_questions",
         params: params.to_json, headers: json_headers
  end

  def read
    get "/api/v1/recruitment/candidates/#{candidate.id}/interview_questions"
  end

  describe "before anything is generated" do
    it "returns an empty set rather than 404, so the panel can open" do
      login_admin
      read

      expect(response).to have_http_status(:ok)
      expect(body["questions"]).to eq([])
      expect(body["generatedAt"]).to be_nil
    end

    it "does not call the AI just because the panel was opened" do
      login_admin
      expect(Ai::Provider).not_to receive(:for)

      read
      expect(response).to have_http_status(:ok)
    end
  end

  describe "generating" do
    before { login_admin }

    it "returns twenty questions across the five areas" do
      generate

      expect(response).to have_http_status(:created)
      expect(body["questions"].size).to eq(20)
      expect(body["questions"].map { |q| q["area"] }.uniq)
        .to match_array(%w[experience technical role_fit behavioural closing])
    end

    it "gives each question the text and the note for the interviewer" do
      generate

      first = body["questions"].first
      expect(first["question"]).to be_present
      expect(first["whyItMatters"]).to be_present
    end

    it "stores them, so the next interviewer opens the same set for free" do
      generate
      generated = body["questions"]

      expect(Ai::Provider).not_to receive(:for)
      read

      expect(body["questions"]).to eq(generated)
      expect(body["generatedAt"]).to be_present
    end

    it "records the call in the AI audit trail" do
      expect { generate }
        .to change { in_tenant { AiProcessingLog.where(operation: "interview_questions").count } }.by(1)

      log = in_tenant { AiProcessingLog.where(operation: "interview_questions").last }
      expect(log.status).to eq("success")
      expect(log.candidate_id).to eq(candidate.id)
    end

    it "records who asked for it in the ordinary audit trail" do
      generate

      expect(in_tenant { AuditLog.where(action: "candidate.interview_questions_generated").count }).to eq(1)
    end

    it "replaces the previous set when regenerated" do
      generate
      first_time = in_tenant { candidate.reload.interview_questions_generated_at }

      travel_to(1.hour.from_now) { generate }

      expect(in_tenant { candidate.reload.interview_questions_generated_at }).to be > first_time
      expect(body["questions"].size).to eq(20)
    end
  end

  describe "which job the questions are written against" do
    before { login_admin }

    let!(:job) do
      in_tenant { Job.create!(company: company, title: "Staff Engineer", status: :open) }
    end

    it "uses the job the caller names" do
      generate(job_id: job.id)

      expect(body.dig("job", "title")).to eq("Staff Engineer")
    end

    it "falls back to the candidate's best match when none is named" do
      other = in_tenant { Job.create!(company: company, title: "Junior Engineer", status: :open) }
      in_tenant do
        candidate.candidate_job_matches.create!(company: company, job: other, match_score: 40)
        candidate.candidate_job_matches.create!(company: company, job: job, match_score: 90)
      end

      generate

      expect(body.dig("job", "title")).to eq("Staff Engineer")
    end

    it "works with no job at all — a candidate can be interviewed on their resume alone" do
      generate

      expect(response).to have_http_status(:created)
      expect(body["job"]).to be_nil
      expect(body["questions"].size).to eq(20)
    end

    it "will not write questions against another company's job" do
      other_company = Company.create!(name: "Rival Corp")
      foreign = ActsAsTenant.with_tenant(other_company) do
        Job.create!(company: other_company, title: "Secret Role", status: :open)
      end

      generate(job_id: foreign.id)

      # Not found for this tenant, so it proceeds with no job rather than
      # leaking the other company's role into the prompt.
      expect(response).to have_http_status(:created)
      expect(body["job"]).to be_nil
    end
  end

  describe "when the AI fails" do
    before { login_admin }

    it "says so instead of storing an empty set" do
      allow(Ai::InterviewQuestionGenerator).to receive(:call)
        .and_raise(Ai::InterviewQuestionGenerator::Error, "The AI returned no usable questions. Try again.")

      generate

      expect(response).to have_http_status(:unprocessable_content)
      expect(errors.first["message"]).to match(/no usable questions/i)
      expect(in_tenant { candidate.reload.interview_questions }).to be_nil
    end
  end

  describe "permissions" do
    let!(:plain_employee) do
      in_tenant do
        user = create(:user, company: company, email_address: "emp@acme.test", password: password)
        create(:user_role, user: user, role: company.roles.find_by!(slug: "employee"), company: company)
        user
      end
    end

    it "is closed to somebody with no recruitment access" do
      login("emp@acme.test")

      read
      expect(response).to have_http_status(:forbidden)

      generate
      expect(response).to have_http_status(:forbidden)
    end

    it "does not reach another company's candidate" do
      other_company = Company.create!(name: "Rival Corp")
      ActsAsTenant.with_tenant(other_company) do
        ::Roles::SeedDefaults.call(other_company)
        user = create(:user, company: other_company, email_address: "rival@acme.test", password: password)
        create(:user_role, user: user, role: other_company.roles.find_by!(slug: "admin"), company: other_company)
      end

      login("rival@acme.test")
      read

      expect(response).to have_http_status(:not_found)
    end
  end
end

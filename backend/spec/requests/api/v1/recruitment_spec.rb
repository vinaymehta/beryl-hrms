require "rails_helper"

RSpec.describe "Api::V1::Recruitment", type: :request do
  let(:other_company) { create(:company) }

  before do
    post "/api/v1/auth/register",
         params: {
           companyName: "Acme Recruitment Corp",
           firstName: "Admin",
           lastName: "User",
           email: "recruiter.admin@acme.test",
           password: "correct-horse-battery-1",
           passwordConfirmation: "correct-horse-battery-1"
         }.to_json,
         headers: { "Content-Type" => "application/json" }
  end

  let(:company) { Company.find_by!(name: "Acme Recruitment Corp") }

  describe "GET /api/v1/recruitment/dashboard/stats" do
    it "returns real SQL aggregation metrics for candidates and resumes" do
      ActsAsTenant.with_tenant(company) do
        create(:candidate, company: company, status: :shortlisted)
        create(:candidate, company: company, status: :needs_review)
        create(:candidate_resume, company: company, processing_status: :completed)
      end

      get "/api/v1/recruitment/dashboard/stats"

      expect(response).to have_http_status(:ok)
      data = response.parsed_body["data"]
      expect(data["totalCandidates"]).to eq(2)
      expect(data["shortlistedCandidates"]).to eq(1)
      expect(data["needsReviewCandidates"]).to eq(1)
      expect(data["processedResumes"]).to eq(1)
    end
  end

  describe "Tenant Isolation" do
    it "does not expose other company's candidates" do
      candidate_b = ActsAsTenant.with_tenant(other_company) do
        create(:candidate, company: other_company, full_name: "Secret Candidate B")
      end

      get "/api/v1/recruitment/candidates"
      expect(response).to have_http_status(:ok)
      candidate_names = response.parsed_body["data"].map { |c| c["fullName"] }
      expect(candidate_names).not_to include("Secret Candidate B")

      get "/api/v1/recruitment/candidates/#{candidate_b.id}"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "PATCH /api/v1/recruitment/candidates/:id/shortlist" do
    it "updates the candidate status to shortlisted" do
      candidate = ActsAsTenant.with_tenant(company) do
        create(:candidate, company: company, status: :needs_review)
      end

      patch "/api/v1/recruitment/candidates/#{candidate.id}/shortlist"

      expect(response).to have_http_status(:ok)
      expect(candidate.reload.status).to eq("shortlisted")
    end
  end

  describe "POST /api/v1/recruitment/search/ai" do
    it "interprets query and searches candidates deterministically" do
      ActsAsTenant.with_tenant(company) do
        c = create(:candidate, company: company, city: "Bangalore", experience_years: 5)
        c.candidate_skills.create!(name: "Java", company: company)
      end

      post "/api/v1/recruitment/search/ai",
           params: { query: "Senior Java developer in Bangalore with 5 years" }.to_json,
           headers: { "Content-Type" => "application/json" }

      expect(response).to have_http_status(:ok)
      data = response.parsed_body["data"]
      expect(data["criteria"]).to be_present
      expect(data["candidates"]).not_to be_empty
    end
  end

  describe "GET /api/v1/recruitment/resumes/:id/download" do
    it "redirects to a short-lived signed storage URL rather than streaming the file inline" do
      resume = ActsAsTenant.with_tenant(company) do
        r = create(:candidate_resume, company: company)
        r.file.attach(io: StringIO.new("resume contents"), filename: "resume.pdf", content_type: "application/pdf")
        r
      end

      get "/api/v1/recruitment/resumes/#{resume.id}/download"

      expect(response).to have_http_status(:found)
      expect(response.headers["Location"]).to be_present
    end

    it "404s when no file is attached, without leaking a storage error" do
      resume = ActsAsTenant.with_tenant(company) { create(:candidate_resume, company: company) }

      get "/api/v1/recruitment/resumes/#{resume.id}/download"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/recruitment/resumes/import_from_zoho" do
    it "reuses the mail workspace's connection-inactive handling instead of hitting Zoho" do
      connection = ActsAsTenant.with_tenant(company) do
        create(:zoho_connection, company: company, status: :revoked)
      end

      post "/api/v1/recruitment/resumes/import_from_zoho",
           params: { connectionId: connection.id, messageId: "m1", attachmentId: "a1", fileName: "cv.pdf" }.to_json,
           headers: { "Content-Type" => "application/json" }

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["errors"].first["code"]).to eq("connection_inactive")
    end
  end

  describe "Candidate duplicate review" do
    it "lets a human confirm or dismiss a flagged duplicate, never automatically" do
      candidate = ActsAsTenant.with_tenant(company) do
        create(:candidate, company: company, duplicate_status: :potential_duplicate)
      end

      patch "/api/v1/recruitment/candidates/#{candidate.id}/confirm_duplicate"
      expect(response).to have_http_status(:ok)
      expect(candidate.reload.duplicate_status).to eq("confirmed_duplicate")

      patch "/api/v1/recruitment/candidates/#{candidate.id}/dismiss_duplicate"
      expect(response).to have_http_status(:ok)
      expect(candidate.reload.duplicate_status).to eq("unique_record")
    end
  end

  describe "GET /api/v1/recruitment/candidates with extended filters" do
    it "filters deterministically by state, country, and job title" do
      ActsAsTenant.with_tenant(company) do
        create(:candidate, company: company, full_name: "Match", state: "Karnataka", country: "India", current_role: "Backend Engineer")
        create(:candidate, company: company, full_name: "NoMatch", state: "Texas", country: "USA", current_role: "Sales Rep")
      end

      get "/api/v1/recruitment/candidates", params: { state: "Karnataka", country: "India", jobTitle: "Backend" }

      expect(response).to have_http_status(:ok)
      names = response.parsed_body["data"].map { |c| c["fullName"] }
      expect(names).to eq(["Match"])
    end
  end

  describe "GET /api/v1/recruitment/dashboard/analytics" do
    it "includes candidatesByJobTitle and matchScoreDistribution alongside the existing breakdowns" do
      ActsAsTenant.with_tenant(company) do
        candidate = create(:candidate, company: company, current_role: "Backend Engineer")
        job = create(:job, company: company)
        create(:candidate_job_match, company: company, candidate: candidate, job: job, match_score: 92)
      end

      get "/api/v1/recruitment/dashboard/analytics"

      expect(response).to have_http_status(:ok)
      data = response.parsed_body["data"]
      expect(data["candidatesByJobTitle"]).to be_present
      expect(data["matchScoreDistribution"]).to be_present
      expect(data["matchScoreDistribution"].sum { |b| b["count"] }).to eq(1)
    end
  end

  describe "POST /api/v1/recruitment/jobs/:id/match_candidates" do
    it "evaluates and creates candidate matches for a job" do
      candidate = ActsAsTenant.with_tenant(company) do
        create(:candidate, company: company, full_name: "Expert Rails Dev", experience_years: 6)
      end

      job = ActsAsTenant.with_tenant(company) do
        create(:job, company: company, title: "Senior Rails Dev", min_experience: 5)
      end

      post "/api/v1/recruitment/jobs/#{job.id}/match_candidates"

      expect(response).to have_http_status(:ok)
      ActsAsTenant.with_tenant(company) do
        expect(job.candidate_job_matches.count).to be >= 1
        match = job.candidate_job_matches.first
        expect(match.match_score).to be_between(0, 100)
      end
    end
  end
end

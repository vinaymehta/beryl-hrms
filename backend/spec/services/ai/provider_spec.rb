require "rails_helper"

RSpec.describe Ai::Provider do
  describe ".for" do
    it "returns MockProvider in test environment" do
      provider = described_class.for
      expect(provider).to be_a(Ai::MockProvider)
    end
  end

  describe "Ai::ResumeParser" do
    it "parses raw text into structured schema distinguishing explicit from inferred" do
      resume_text = "Alice Smith, Full Stack Engineer in Bangalore with 4 years experience in Ruby, React, and PostgreSQL. B.Tech from NIT."
      result = Ai::ResumeParser.parse(resume_text)

      expect(result[:is_likely_resume]).to be true
      expect(result[:candidate][:full_name]).to be_present
      expect(result[:candidate][:city]).to be_present
      expect(result[:candidate][:skills]).not_to be_empty
      expect(result[:provenance]).to be_present
      expect(result[:ai_metadata][:provider]).to be_present
    end
  end

  describe "Ai::CandidateMatcher" do
    let(:company) { create(:company) }
    let(:candidate) do
      ActsAsTenant.with_tenant(company) do
        c = create(:candidate, company: company, full_name: "Bob Dev", experience_years: 5, current_role: "Senior Rails Dev")
        c.candidate_skills.create!(name: "Ruby on Rails", confidence: 1.0, provenance: "explicit", company: company)
        c
      end
    end
    let(:job) do
      ActsAsTenant.with_tenant(company) do
        create(:job, company: company, title: "Senior Backend Engineer", min_experience: 4, required_skills: ["Ruby on Rails"])
      end
    end

    it "computes objective match score, strong matches, and gaps" do
      match = Ai::CandidateMatcher.match(candidate: candidate, job: job)

      expect(match[:match_score]).to be_between(0, 100)
      expect(match[:skills_score]).to be_between(0, 100)
      expect(match[:experience_score]).to be_between(0, 100)
      expect(match[:ai_explanation]).to be_present
    end
  end

  describe "Ai::SearchParser" do
    it "translates natural language to structured search criteria" do
      query = "Senior Java developer in Bangalore with 5+ years"
      parsed = Ai::SearchParser.parse(query)

      expect(parsed[:city]).to eq("Bangalore")
      expect(parsed[:minimum_experience_years]).to eq(5.0)
      expect(parsed[:skills]).to include("Java")
      expect(parsed[:query_interpretation]).to be_present
    end
  end
end

require "rails_helper"

RSpec.describe ResumeExtractionJob, type: :job do
  include ActiveJob::TestHelper

  let(:company) { create(:company) }
  let(:resume) do
    ActsAsTenant.with_tenant(company) do
      create(
        :candidate_resume,
        company: company,
        file_name: "test_resume.txt",
        content_type: "text/plain",
        processing_status: :processing,
        raw_text: "Alice Developer\nEmail: alice.dev@test.com\nLocation: Bangalore\n5 years experience in React, Rails, and PostgreSQL.\nEducation: B.Tech Computer Science"
      )
    end
  end

  it "extracts structured data via AI, resolves/creates a Candidate, and completes the resume" do
    described_class.new.perform(resume.id)

    ActsAsTenant.with_tenant(company) do
      resume.reload
      expect(resume.processing_status).to eq("completed")
      expect(resume.ai_metadata).to be_present
      expect(resume.ai_metadata["prompt_version"]).to eq("v2")

      candidate = resume.candidate
      expect(candidate).to be_present
      expect(candidate.email).to eq("alice.dev@test.com")
      expect(candidate.status).to eq("needs_review") # Human in the loop review state required!
      expect(candidate.candidate_skills.pluck(:name)).to include("Ruby")
    end
  end

  it "attaches to the existing candidate (no new record, no duplicate flag) when email matches — a confident signal" do
    existing = ActsAsTenant.with_tenant(company) do
      create(:candidate, company: company, email: "alice.dev@test.com", full_name: "Alice Existing")
    end

    described_class.new.perform(resume.id)

    ActsAsTenant.with_tenant(company) do
      resume.reload
      candidate = resume.candidate
      expect(candidate.id).to eq(existing.id)
      expect(candidate.duplicate_status).to eq("unique_record") # confident match, no review needed
      expect(resume.is_current).to be true
    end
  end

  it "makes the newly attached resume current and un-currents the candidate's older resumes" do
    existing_candidate = ActsAsTenant.with_tenant(company) do
      create(:candidate, company: company, email: "alice.dev@test.com", full_name: "Alice Existing")
    end
    older_resume = ActsAsTenant.with_tenant(company) do
      create(:candidate_resume, company: company, candidate: existing_candidate, is_current: true)
    end

    described_class.new.perform(resume.id)

    ActsAsTenant.with_tenant(company) do
      expect(resume.reload.is_current).to be true
      expect(older_resume.reload.is_current).to be false
    end
  end

  it "replaces the candidate's skills with the current resume's list instead of accumulating across resumes" do
    existing_candidate = ActsAsTenant.with_tenant(company) do
      c = create(:candidate, company: company, email: "alice.dev@test.com", full_name: "Alice Existing")
      c.candidate_skills.create!(name: "COBOL", provenance: "explicit", confidence: 1.0, company: company)
      c
    end

    described_class.new.perform(resume.id)

    ActsAsTenant.with_tenant(company) do
      skills = existing_candidate.reload.candidate_skills.pluck(:name)
      expect(skills).to include("Ruby")
      expect(skills).not_to include("COBOL") # stale skill from a since-superseded resume
    end
  end

  it "creates a new candidate flagged potential_duplicate when only the name matches (no email/phone signal)" do
    resume_no_contact = ActsAsTenant.with_tenant(company) do
      create(
        :candidate_resume,
        company: company,
        processing_status: :processing,
        raw_text: "Alice Developer\n5 years experience in React, Rails, and PostgreSQL.\nEducation: B.Tech Computer Science"
      )
    end
    ActsAsTenant.with_tenant(company) do
      create(:candidate, company: company, full_name: "Alice Developer", email: "someone.else@test.com")
    end

    described_class.new.perform(resume_no_contact.id)

    ActsAsTenant.with_tenant(company) do
      candidate = resume_no_contact.reload.candidate
      expect(candidate.duplicate_status).to eq("potential_duplicate")
    end
  end

  it "logs a success entry to the AI audit trail" do
    expect {
      described_class.new.perform(resume.id)
    }.to change { ActsAsTenant.with_tenant(company) { AiProcessingLog.count } }.by(1)

    log = ActsAsTenant.with_tenant(company) { AiProcessingLog.last }
    expect(log.operation).to eq("resume_parse")
    expect(log.status).to eq("success")
    expect(log.provider).to eq("mock")
  end

  # Regression test: ResumeExtractionJob used to swallow Ai::RateLimitedError in a
  # blanket `rescue => e` before ActiveJob's retry_on ever saw it, so a transient
  # rate limit was treated as a permanent failure on the very first attempt.
  it "schedules a retry instead of immediately marking the resume failed on a transient AI rate limit" do
    allow(Ai::ResumeParser).to receive(:parse).and_raise(Ai::RateLimitedError, "rate limited, try later")

    expect {
      described_class.new(resume.id).perform_now
    }.to have_enqueued_job(described_class).with(resume.id)

    ActsAsTenant.with_tenant(company) do
      expect(resume.reload.processing_status).to eq("processing") # untouched — not marked failed on a retryable error
    end
  end

  it "marks the resume failed after retries are exhausted, without losing the original file" do
    job = described_class.new
    job.instance_variable_set(:@candidate_resume_id, resume.id)
    job.send(:handle_exhausted_retries, Ai::RateLimitedError.new("rate limited"))

    ActsAsTenant.with_tenant(company) do
      resume.reload
      expect(resume.processing_status).to eq("failed")
      expect(resume.error_message).to include("AI service unavailable")
    end
  end
end

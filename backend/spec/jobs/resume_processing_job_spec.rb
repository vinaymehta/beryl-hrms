require "rails_helper"

RSpec.describe ResumeProcessingJob, type: :job do
  include ActiveJob::TestHelper

  let(:company) { create(:company) }
  let(:resume) do
    ActsAsTenant.with_tenant(company) do
      r = create(:candidate_resume, company: company, file_name: "test_resume.txt", content_type: "text/plain")
      r.file.attach(
        io: StringIO.new("Alice Developer\nEmail: alice.dev@test.com\nLocation: Bangalore\n5 years experience in React, Rails, and PostgreSQL.\nEducation: B.Tech Computer Science"),
        filename: "test_resume.txt",
        content_type: "text/plain"
      )
      r
    end
  end

  it "downloads/extracts text, fingerprints the file, and hands off to ResumeExtractionJob" do
    expect {
      described_class.new.perform(resume.id)
    }.to have_enqueued_job(ResumeExtractionJob).with(resume.id)

    ActsAsTenant.with_tenant(company) do
      resume.reload
      expect(resume.raw_text).to be_present
      expect(resume.file_hash).to be_present
      expect(resume.processing_status).to eq("processing") # AI stage not run yet — original file untouched either way
    end
  end

  it "marks an exact re-submission (identical file bytes) as a duplicate and skips AI reprocessing entirely" do
    original = ActsAsTenant.with_tenant(company) do
      create(:candidate_resume, company: company, file_name: "original.txt", content_type: "text/plain",
             file_hash: Digest::SHA256.hexdigest("Alice Developer\nEmail: alice.dev@test.com\nLocation: Bangalore\n5 years experience in React, Rails, and PostgreSQL.\nEducation: B.Tech Computer Science"),
             processing_status: :completed)
    end

    expect {
      described_class.new.perform(resume.id)
    }.not_to have_enqueued_job(ResumeExtractionJob)

    ActsAsTenant.with_tenant(company) do
      resume.reload
      expect(resume.processing_status).to eq("duplicate")
      expect(resume.duplicate_of_id).to eq(original.id)
      expect(resume.is_current).to be false
      expect(original.reload.processing_status).to eq("completed") # original untouched
    end
  end

  it "marks the resume failed (without losing the original file) when no readable text can be extracted" do
    ActsAsTenant.with_tenant(company) do
      resume.file.attach(io: StringIO.new(""), filename: "empty.txt", content_type: "text/plain")
    end

    described_class.new.perform(resume.id)

    ActsAsTenant.with_tenant(company) do
      resume.reload
      expect(resume.processing_status).to eq("failed")
      expect(resume.error_message).to be_present
      expect(resume.file).to be_attached
    end
  end
end

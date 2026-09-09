require "rails_helper"

RSpec.describe Recruitment::DocumentTextExtractor do
  describe ".extract" do
    it "extracts plain text documents" do
      content = "John Doe\nSoftware Engineer\n5 years experience with Ruby and React\nEducation: B.Tech in Computer Science"
      result = described_class.extract(content, filename: "resume.txt", content_type: "text/plain")

      expect(result[:text]).to include("John Doe")
      expect(result[:text]).to include("Software Engineer")
      expect(result[:word_count]).to be > 5
      expect(result[:error]).to be_nil
    end

    it "handles blank or empty content gracefully" do
      result = described_class.extract("", filename: "empty.txt", content_type: "text/plain")
      expect(result[:text]).to be_blank
      expect(result[:error]).to be_present
    end

    it "handles corrupt or unreadable PDF content gracefully" do
      corrupt_bytes = "not-a-real-pdf-file-header"
      result = described_class.extract(corrupt_bytes, filename: "corrupt.pdf", content_type: "application/pdf")

      expect(result[:text]).to be_blank
      expect(result[:error]).to be_present
    end
  end
end

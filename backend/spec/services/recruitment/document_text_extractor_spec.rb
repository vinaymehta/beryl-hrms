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

    # A .docx is a zip, opened through rubyzip. Nothing covered this branch
    # until the gem was taken across a major version to clear CVE-2026-85396,
    # at which point "the whole suite passes" said nothing about whether
    # resume parsing still worked. It does, and now it says so.
    it "extracts text from a .docx by reading its zipped document.xml" do
      buffer = Zip::OutputStream.write_buffer do |zip|
        zip.put_next_entry("word/document.xml")
        zip.write("<w:p><w:t>Ada Lovelace</w:t></w:p><w:p><w:t>Staff Engineer, 9 years</w:t></w:p>")
      end
      buffer.rewind

      result = described_class.extract(
        buffer.read,
        filename: "resume.docx",
        content_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )

      expect(result[:text]).to include("Ada Lovelace", "Staff Engineer")
      expect(result[:error]).to be_nil
    end

    it "falls back rather than raising on a .docx that isn't a readable zip" do
      result = described_class.extract(
        "PK\x03\x04 truncated nonsense",
        filename: "broken.docx",
        content_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )

      expect(result).to be_a(Hash)
    end

    it "handles corrupt or unreadable PDF content gracefully" do
      corrupt_bytes = "not-a-real-pdf-file-header"
      result = described_class.extract(corrupt_bytes, filename: "corrupt.pdf", content_type: "application/pdf")

      expect(result[:text]).to be_blank
      expect(result[:error]).to be_present
    end
  end
end

require "rails_helper"

RSpec.describe Document do
  let(:company) { create(:company) }
  let(:uploader) { ActsAsTenant.with_tenant(company) { create(:user, company: company) } }

  def build_document(**attrs)
    ActsAsTenant.with_tenant(company) do
      described_class.new({ company: company, uploaded_by: uploader, title: "Aadhaar.pdf" }.merge(attrs))
    end
  end

  it "accepts a category from the catalogue" do
    expect(build_document(document_type: "offer_letter")).to be_valid
  end

  it "rejects a category that isn't one of the offered ones" do
    document = build_document(document_type: "Payslip")

    expect(document).not_to be_valid
    expect(document.errors[:document_type]).to include("is not a valid document category")
  end

  it "requires a category at all" do
    expect(build_document(document_type: nil)).not_to be_valid
  end

  describe "the Other category" do
    it "requires the custom name" do
      document = build_document(document_type: "other")

      expect(document).not_to be_valid
      expect(document.errors[:custom_category]).to include("is required when the category is Other")
    end

    it "is valid once named" do
      expect(build_document(document_type: "other", custom_category: "Gym membership")).to be_valid
    end

    # Two fields both claiming to name the document leaves the list guessing
    # which to show.
    it "refuses a custom name on a category that already names itself" do
      document = build_document(document_type: "pan", custom_category: "Something else")

      expect(document).not_to be_valid
      expect(document.errors[:custom_category]).to include("only applies when the category is Other")
    end

    it "labels itself with the custom name" do
      expect(build_document(document_type: "other", custom_category: "Gym membership").category_label).to eq("Gym membership")
    end
  end

  # The client never sent a title, so every upload failed the presence
  # validation outright. The filename is already a perfectly good name.
  it "falls back to the filename when no title is given" do
    document = build_document(title: nil, document_type: "resume")
    document.file.attach(io: StringIO.new("x"), filename: "Priya_CV.pdf", content_type: "application/pdf")

    expect(document).to be_valid
    expect(document.title).to eq("Priya_CV.pdf")
  end

  it "keeps an explicit title" do
    document = build_document(title: "Signed copy", document_type: "employment_contract")
    document.file.attach(io: StringIO.new("x"), filename: "contract.pdf", content_type: "application/pdf")

    expect(document).to be_valid
    expect(document.title).to eq("Signed copy")
  end
end

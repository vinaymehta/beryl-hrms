require "rails_helper"

# The workbook is the source of truth for the WHOLE form, not just the seven
# rated categories.
#
# The contract these pin down is: what an admin changes in the spreadsheet is
# what an employee sees in the wizard, with no frontend change in between — and
# a template a cycle has already started against never moves underneath it.
RSpec.describe "Api::V1::AppraisalTemplates structure", type: :request do
  before do
    post "/api/v1/auth/register",
         params: {
           companyName: "Structure Corp", firstName: "Ada", lastName: "Admin",
           email: "structure.admin@acme.test", password: "correct-horse-battery-1",
           passwordConfirmation: "correct-horse-battery-1"
         }.to_json,
         headers: { "Content-Type" => "application/json" }
  end

  let(:company) { Company.find_by!(name: "Structure Corp") }
  let(:json_headers) { { "Content-Type" => "application/json" } }

  def in_tenant(&) = ActsAsTenant.with_tenant(company, &)
  def body = response.parsed_body["data"]

  FIXTURE = Rails.root.join("spec/fixtures/files/Beryl_Systems_Engineering_Appraisal_2026.xlsm").freeze

  def upload(path, filename: "Beryl_Systems_Engineering_Appraisal_2026.xlsm")
    post "/api/v1/appraisal_templates/import_preview",
         params: {
           file: Rack::Test::UploadedFile.new(
             path, "application/vnd.ms-excel.sheet.macroEnabled.12", original_filename: filename
           )
         }
  end

  # The real workbook, rewritten with the caller's edits applied. Built from the
  # fixture's own rows so it stays a faithful copy of the layout — only the
  # cells under test change.
  def workbook_with(edits = {})
    book = Roo::Spreadsheet.open(FIXTURE.to_s, extension: "xlsx")
    sheet = book.sheet(0)
    rows = (1..sheet.last_row).map { |number| sheet.row(number) }
    edits.each { |(row, column), value| rows[row - 1][column - 1] = value }

    package = Axlsx::Package.new
    package.workbook.add_worksheet(name: "Appraisal 2026") do |out|
      rows.each { |row| out.add_row(row) }
    end
    file = Tempfile.new([ "modified", ".xlsx" ])
    file.binmode
    file.write(package.to_stream.read)
    file.rewind
    file
  end

  # Turns a preview into the create payload the builder sends, so these
  # exercise the same round trip the UI performs.
  def create_template_from(preview, name:, status: "draft")
    post "/api/v1/appraisal_templates",
         params: {
           name: name, status: status,
           structure: {
             assessmentPeriod: preview["assessmentPeriod"],
             perspectives: preview["perspectives"],
             developmentFields: preview["developmentFields"],
             finalReviewFields: preview["finalReviewFields"],
             ratingGuide: preview["ratingGuide"],
             wizardSections: preview["wizardSections"]
           },
           categoriesAttributes: preview["categories"].each_with_index.map do |category, position|
             {
               name: category["name"], lens: "past", weight: category["weight"],
               position: position, description: category["description"],
               questionsAttributes: category["questions"].each_with_index.map do |question, qp|
                 { prompt: question["prompt"], description: question["description"], position: qp }
               end
             }
           end
         }.to_json, headers: json_headers
  end

  describe "import preview" do
    before { upload(FIXTURE) }

    it "describes the wizard's steps rather than leaving the frontend to invent them" do
      sections = body["wizardSections"]

      expect(sections.map { |section| section["key"] })
        .to eq(%w[perspectives development final_review])
      expect(sections.map { |section| section["title"] }).to eq([
        "Performance Perspective", "Development & Career Discussion", "Final Review"
      ])
    end

    it "carries the three perspectives as fields, with their weights and focus" do
      perspectives = body["wizardSections"].find { |section| section["key"] == "perspectives" }

      expect(perspectives["fields"].map { |field| field["label"] })
        .to eq([ "Past Performance", "Current Capability", "Future Readiness" ])
      expect(perspectives["fields"].map { |field| field["weight"] }).to eq([ 60.0, 25.0, 15.0 ])
      expect(perspectives["fields"].first["description"]).to match(/what the employee actually delivered/i)
    end

    it "carries the development & career prompts, which drive the free-text step" do
      development = body["wizardSections"].find { |section| section["key"] == "development" }

      expect(development["fields"].map { |field| field["label"] }).to eq([
        "Key Achievements / Contributions",
        "Key Strengths",
        "Areas for Improvement",
        "Skills / Training Required for Next 12 Months",
        "Next-Year Goals / Increased Responsibilities"
      ])
    end

    it "marks the final review as the reviewer's, so it is not a step the employee walks" do
      final = body["wizardSections"].find { |section| section["key"] == "final_review" }

      expect(final["audience"]).to eq("reviewer")
      expect(final["fields"].size).to eq(6)
    end

    it "gives every field a stable key an answer can be filed against" do
      keys = body["wizardSections"].flat_map { |section| section["fields"].map { |field| field["key"] } }

      expect(keys).to include("past_performance", "key_strengths", "manager_final_comments")
      expect(keys).to all(match(/\A[a-z0-9_]+\z/))
      expect(keys.uniq.size).to eq(keys.size)
    end
  end

  describe "the created template" do
    it "stores the complete configurable form structure" do
      upload(FIXTURE)
      create_template_from(body, name: "Engineering 2026")

      expect(response).to have_http_status(:created)
      structure = body["structure"]

      expect(structure["perspectives"].size).to eq(3)
      expect(structure["developmentFields"].size).to eq(5)
      expect(structure["finalReviewFields"].size).to eq(6)
      expect(structure["ratingGuide"].size).to eq(5)
      expect(structure["wizardSections"].size).to eq(3)
      expect(body["categories"].size).to eq(7)
    end

    it "stores the rating guide's labels and definitions" do
      upload(FIXTURE)
      create_template_from(body, name: "Engineering 2026")

      guide = body["structure"]["ratingGuide"]
      expect(guide.map { |row| row["level"] }).to eq([
        "Exceptional", "Strong", "Meets Expectations", "Needs Improvement", "Unsatisfactory"
      ])
      expect(guide.map { |row| row["definition"] }).to all(be_present)
    end
  end

  # The point of the whole exercise: the spreadsheet is the form.
  describe "an admin edits the workbook" do
    it "renames a development prompt, and the new template asks the new question" do
      # Row 32 column A is "Key Strengths".
      file = workbook_with([ 32, 1 ] => "Signature Strengths & Superpowers")
      upload(file.path, filename: "edited.xlsx")

      development = body["wizardSections"].find { |section| section["key"] == "development" }
      labels = development["fields"].map { |field| field["label"] }

      expect(labels).to include("Signature Strengths & Superpowers")
      expect(labels).not_to include("Key Strengths")
      expect(development["fields"].map { |field| field["key"] }).to include("signature_strengths_superpowers")
    end

    it "changes a category's weight, and the new template carries the new weight" do
      # Row 9 column C is the 20% on Technical Skills & Code Quality.
      file = workbook_with([ 9, 3 ] => 0.30, [ 15, 3 ] => 0.0)
      upload(file.path, filename: "edited.xlsx")

      weights = body["categories"].to_h { |category| [ category["name"], category["weight"] ] }
      expect(weights["Technical Skills & Code Quality"]).to eq(30.0)
    end

    it "changes a perspective's weight and focus, and both follow through" do
      file = workbook_with([ 22, 2 ] => 0.5, [ 22, 3 ] => "Only what shipped, measured by impact")
      upload(file.path, filename: "edited.xlsx")

      past = body["wizardSections"].find { |s| s["key"] == "perspectives" }["fields"].first
      expect(past["weight"]).to eq(50.0)
      expect(past["description"]).to eq("Only what shipped, measured by impact")
    end

    it "adds a final-review field, and it appears in the template" do
      # Row 50 is blank in the fixture, directly under Employee Final Comments.
      file = workbook_with([ 50, 1 ] => "Retention Risk")
      upload(file.path, filename: "edited.xlsx")

      labels = body["wizardSections"].find { |s| s["key"] == "final_review" }["fields"].map { |f| f["label"] }
      expect(labels).to include("Retention Risk")
    end

    it "removes a performance area, and the new template has one fewer" do
      # Blank out row 15 (Business & Client Impact) entirely.
      file = workbook_with([ 15, 1 ] => nil, [ 15, 2 ] => nil, [ 15, 3 ] => nil, [ 15, 4 ] => nil)
      upload(file.path, filename: "edited.xlsx")

      expect(body["categories"].size).to eq(6)
      expect(body["categories"].map { |c| c["name"] }).not_to include("Business & Client Impact")
    end

    it "still accounts for every populated row after an edit" do
      file = workbook_with([ 32, 1 ] => "Signature Strengths")
      upload(file.path, filename: "edited.xlsx")

      expect(body["unmappedRows"]).to eq([])
    end
  end

  describe "templates already in use" do
    it "leaves a started cycle's template exactly as it was when a new one is imported" do
      upload(FIXTURE)
      create_template_from(body, name: "FY26 Original", status: "active")
      original_id = body["id"]
      original_structure = body["structure"]

      # Start a cycle against it, which is what freezes it.
      employee = in_tenant do
        user = create(:user, company: company, email_address: "sub@acme.test")
        create(:user_role, user: user, role: company.roles.find_by!(slug: "employee"), company: company)
        subject_employee = create(:employee, company: company, user: user)
        manager = create(:employee, company: company)
        subject_employee.assign_managers!("primary" => manager.id, "final" => manager.id)
        subject_employee
      end

      post "/api/v1/appraisal_cycles",
           params: { name: "FY26", appraisalTemplateId: original_id, eligibleEmployeeIds: [ employee.id ] }.to_json,
           headers: json_headers
      cycle_id = body["id"]
      post "/api/v1/appraisal_cycles/#{cycle_id}/start", params: {}.to_json, headers: json_headers
      expect(response).to have_http_status(:ok)

      # The admin now imports a changed workbook and creates a SECOND template.
      file = workbook_with([ 32, 1 ] => "Signature Strengths")
      upload(file.path, filename: "edited.xlsx")
      create_template_from(body, name: "FY27 Revised")
      revised_id = body["id"]

      expect(revised_id).not_to eq(original_id)
      expect(body["structure"]["developmentFields"].map { |f| f["label"] }).to include("Signature Strengths")

      # And the original is untouched — same structure, same questions.
      get "/api/v1/appraisal_templates/#{original_id}"
      expect(body["structure"]).to eq(original_structure)
      expect(body["structure"]["developmentFields"].map { |f| f["label"] }).to include("Key Strengths")
      expect(body["inUse"]).to be(true)
    end

    it "refuses to edit a template a cycle has started against" do
      upload(FIXTURE)
      create_template_from(body, name: "Frozen", status: "active")
      template_id = body["id"]

      employee = in_tenant do
        subject_employee = create(:employee, company: company)
        manager = create(:employee, company: company)
        subject_employee.assign_managers!("primary" => manager.id, "final" => manager.id)
        subject_employee
      end
      post "/api/v1/appraisal_cycles",
           params: { name: "C", appraisalTemplateId: template_id, eligibleEmployeeIds: [ employee.id ] }.to_json,
           headers: json_headers
      post "/api/v1/appraisal_cycles/#{body['id']}/start", params: {}.to_json, headers: json_headers

      patch "/api/v1/appraisal_templates/#{template_id}",
            params: { name: "Renamed" }.to_json, headers: json_headers

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "answering the template's own fields" do
    it "stores an answer against a workbook field key, and refuses one the template never defined" do
      upload(FIXTURE)
      create_template_from(body, name: "FY26", status: "active")
      template_id = body["id"]

      employee = in_tenant do
        user = create(:user, company: company, email_address: "emp@acme.test", password: "correct-horse-battery-1")
        create(:user_role, user: user, role: company.roles.find_by!(slug: "employee"), company: company)
        subject_employee = create(:employee, company: company, user: user)
        manager = create(:employee, company: company)
        subject_employee.assign_managers!("primary" => manager.id, "final" => manager.id)
        subject_employee
      end

      post "/api/v1/appraisal_cycles",
           params: { name: "FY26", appraisalTemplateId: template_id, eligibleEmployeeIds: [ employee.id ] }.to_json,
           headers: json_headers
      post "/api/v1/appraisal_cycles/#{body['id']}/start", params: {}.to_json, headers: json_headers
      appraisal = in_tenant { Appraisal.find_by!(employee_id: employee.id) }

      post "/api/v1/auth/login",
           params: { email: "emp@acme.test", password: "correct-horse-battery-1" }.to_json, headers: json_headers
      post "/api/v1/appraisals/#{appraisal.id}/submit_self",
           params: {
             answers: [],
             responses: {
               key_strengths: "Shipped the importer end to end.",
               not_a_field_on_this_template: "should be dropped"
             }
           }.to_json, headers: json_headers

      expect(response).to have_http_status(:ok)
      stored = in_tenant { appraisal.revisions.order(:version_number).last.responses }
      expect(stored["key_strengths"]).to eq("Shipped the importer end to end.")
      expect(stored).not_to have_key("not_a_field_on_this_template")
    end
  end
end

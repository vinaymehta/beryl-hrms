require "rails_helper"

# Scope §5 — importing template questions from a spreadsheet.
#
# The whole point is that import PREVIEWS and never writes: the parsed structure
# goes back to the builder, the admin confirms it there, and the ordinary create
# endpoint saves it — so the 100% weight rule and every other template guard
# apply to an imported template exactly as to a hand-built one.
RSpec.describe "Api::V1::AppraisalTemplates import", type: :request do
  before do
    post "/api/v1/auth/register",
         params: {
           companyName: "Import Corp", firstName: "Ada", lastName: "Admin",
           email: "import.admin@acme.test", password: "correct-horse-battery-1",
           passwordConfirmation: "correct-horse-battery-1"
         }.to_json,
         headers: { "Content-Type" => "application/json" }
  end

  let(:company) { Company.find_by!(name: "Import Corp") }
  let(:json_headers) { { "Content-Type" => "application/json" } }

  def in_tenant(&) = ActsAsTenant.with_tenant(company, &)
  def body = response.parsed_body["data"]

  def upload(csv, filename: "template.csv", type: "text/csv")
    file = Tempfile.new([ "tpl", File.extname(filename) ])
    file.write(csv)
    file.rewind
    post "/api/v1/appraisal_templates/import_preview",
         params: { file: Rack::Test::UploadedFile.new(file.path, type, original_filename: filename) }
  end

  # The scope's seven areas at their stated weights (20/20/15/15/10/10/10 = 100).
  SEVEN_AREAS = <<~CSV.freeze
    Category,Lens,Weight %,Question,Guidance,Self rating,Manager rating,Evidence required,Required
    Technical Skills & Code Quality,Past,20,Writes maintainable code,Judged over the period,Yes,Yes,Yes,Yes
    Delivery & Productivity,Past,20,Met agreed commitments,,Yes,Yes,,Yes
    Ownership & Accountability,Past,15,Takes end-to-end ownership,,Yes,Yes,,Yes
    AI & Modern Engineering Skills,Future readiness,15,Applies modern tooling,,Yes,Yes,,Yes
    Learning & Skill Growth,Current capability,10,Grows deliberately,,Yes,Yes,,Yes
    Communication & Teamwork,Current capability,10,Communicates clearly,,Yes,Yes,,Yes
    Business & Client Impact,Past,10,Creates client value,,Yes,Yes,,Yes
  CSV

  describe "preview" do
    it "parses the seven areas and confirms the weights total 100" do
      expect { upload(SEVEN_AREAS) }.not_to change { in_tenant { AppraisalTemplate.count } }

      expect(response).to have_http_status(:ok)
      expect(body["categories"].size).to eq(7)
      expect(body["questionCount"]).to eq(7)
      expect(body["totalWeight"]).to eq(100.0)
      expect(body["weightsValid"]).to be(true)
      expect(body["errors"]).to be_empty
    end

    it "keeps the three lenses the scope defines" do
      upload(SEVEN_AREAS)

      lenses = body["categories"].to_h { |c| [ c["name"], c["lens"] ] }
      expect(lenses["Technical Skills & Code Quality"]).to eq("past")
      expect(lenses["AI & Modern Engineering Skills"]).to eq("future_readiness")
      expect(lenses["Learning & Skill Growth"]).to eq("current_capability")
    end

    it "groups several questions under one category" do
      upload(<<~CSV)
        Category,Lens,Weight %,Question
        Delivery,Past,100,Met commitments
        Delivery,Past,100,Quality of work
        Delivery,Past,100,Predictability
      CSV

      expect(body["categories"].size).to eq(1)
      expect(body["categories"].first["questions"].size).to eq(3)
      expect(body["weightsValid"]).to be(true)
    end

    it "flags weights that don't total 100 instead of accepting them" do
      upload(<<~CSV)
        Category,Lens,Weight %,Question
        A,Past,60,Q1
        B,Past,30,Q2
      CSV

      expect(body["totalWeight"]).to eq(90.0)
      expect(body["weightsValid"]).to be(false)
    end

    it "reports an unknown lens rather than guessing one" do
      upload(<<~CSV)
        Category,Lens,Weight %,Question
        A,Sideways,100,Q1
      CSV

      expect(body["errors"].join).to match(/not a known lens/i)
    end

    it "reports a category whose rows disagree about lens or weight" do
      upload(<<~CSV)
        Category,Lens,Weight %,Question
        A,Past,60,Q1
        A,Future readiness,40,Q2
      CSV

      joined = body["errors"].join
      expect(joined).to match(/disagrees/i)
    end

    it "defaults the flag columns when they are left blank" do
      upload(<<~CSV)
        Category,Lens,Weight %,Question
        A,Past,100,Q1
      CSV

      question = body["categories"].first["questions"].first
      expect(question["selfRating"]).to be(true)
      expect(question["managerRating"]).to be(true)
      expect(question["requiresComment"]).to be(false)
      expect(question["required"]).to be(true)
    end

    it "ignores spacer and notes rows that carry no question" do
      upload(<<~CSV)
        Category,Lens,Weight %,Question
        A,Past,100,Q1

        Category and Weight repeat on every row of a category.,,,
      CSV

      expect(body["categories"].size).to eq(1)
      expect(body["errors"]).to be_empty
    end

    it "refuses a file that isn't a spreadsheet" do
      upload("hello", filename: "notes.txt", type: "text/plain")

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["errors"].first["message"]).to match(/\.xlsx.*\.csv/i)
    end

    it "refuses a sheet with no Category or Question column" do
      upload("Foo,Bar\n1,2\n")

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["errors"].first["message"]).to match(/Category.*Question/i)
    end

    it "parses .xlsm corporate appraisal workbook fixture successfully" do
      fixture_path = Rails.root.join("spec/fixtures/files/Beryl_Systems_Engineering_Appraisal_2026.xlsm")
      post "/api/v1/appraisal_templates/import_preview",
           params: {
             file: Rack::Test::UploadedFile.new(
               fixture_path,
               "application/vnd.ms-excel.sheet.macroEnabled.12",
               original_filename: "Beryl_Systems_Engineering_Appraisal_2026.xlsm"
             )
           }

      expect(response).to have_http_status(:ok)
      expect(body["categories"].size).to eq(7)
      expect(body["questionCount"]).to eq(7)
      expect(body["totalWeight"]).to eq(100.0)
      expect(body["weightsValid"]).to be(true)
      expect(body["errors"]).to be_empty
    end

    it "produces a useful validation error for corrupt or unreadable spreadsheets" do
      file = Tempfile.new([ "corrupt", ".xlsm" ])
      file.write("not an actual zip or excel file")
      file.rewind

      post "/api/v1/appraisal_templates/import_preview",
           params: {
             file: Rack::Test::UploadedFile.new(
               file.path,
               "application/vnd.ms-excel.sheet.macroEnabled.12",
               original_filename: "corrupt.xlsm"
             )
           }

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["errors"].first["message"]).to match(/couldn't be read as a spreadsheet/i)
    end

    it "is closed to someone who can't manage templates" do
      employee = in_tenant do
        user = create(:user, company: company, email_address: "staff@acme.test", password: "correct-horse-battery-1")
        create(:user_role, user: user, role: company.roles.find_by!(slug: "employee"), company: company)
        create(:employee, company: company, user: user)
      end
      expect(employee).to be_present
      post "/api/v1/auth/login",
           params: { email: "staff@acme.test", password: "correct-horse-battery-1" }.to_json, headers: json_headers

      upload(SEVEN_AREAS)

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "the preview round-trips into a real template" do
    it "creates a template from the previewed structure, with the same rules applied" do
      upload(SEVEN_AREAS)
      preview = body

      post "/api/v1/appraisal_templates",
           params: {
             name: "Imported 2026", status: "active",
             categoriesAttributes: preview["categories"].map do |category|
               {
                 name: category["name"], lens: category["lens"],
                 weight: category["weight"], position: category["position"],
                 questionsAttributes: category["questions"].each_with_index.map do |question, i|
                   question.merge("position" => i)
                 end
               }
             end
           }.to_json, headers: json_headers

      expect(response).to have_http_status(:created)
      expect(body["categories"].size).to eq(7)
      expect(body["totalWeight"]).to eq(100.0)
      expect(body["status"]).to eq("active")
    end

    it "is still rejected on save when the imported weights don't total 100" do
      upload(<<~CSV)
        Category,Lens,Weight %,Question
        A,Past,60,Q1
      CSV

      post "/api/v1/appraisal_templates",
           params: {
             name: "Lopsided import", status: "active",
             categoriesAttributes: body["categories"].map do |category|
               { name: category["name"], lens: category["lens"], weight: category["weight"], position: 0,
                 questionsAttributes: [ { prompt: category["questions"].first["prompt"], position: 0 } ] }
             end
           }.to_json, headers: json_headers

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["errors"].first["message"]).to match(/must total 100/i)
    end
  end

  describe "format download" do
    it "hands out a blank workbook carrying the headers the importer reads" do
      get "/api/v1/appraisal_templates/import_format"

      expect(response).to have_http_status(:ok)
      expect(response.media_type).to eq("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      expect(response.headers["Content-Disposition"]).to match(/appraisal-template-format\.xlsx/)
    end

    it "round-trips: the downloaded format imports cleanly" do
      get "/api/v1/appraisal_templates/import_format"
      file = Tempfile.new([ "fmt", ".xlsx" ], binmode: true)
      file.write(response.body)
      file.rewind

      post "/api/v1/appraisal_templates/import_preview",
           params: { file: Rack::Test::UploadedFile.new(
             file.path,
             "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
             original_filename: "fmt.xlsx"
           ) }

      expect(response).to have_http_status(:ok)
      expect(body["weightsValid"]).to be(true)
      expect(body["errors"]).to be_empty
    end
  end
end

require "rails_helper"

# Uploading a workbook that somebody has already filled in.
#
# Both halves of the feature get the SAME document: an Admin importing the
# company form to define a template, and an employee handing back their
# completed copy of that same form. The two used to disagree about what a
# workbook even is — the template importer read the real .xlsm, while the
# appraisal importer accepted only the answer sheet its own Export button
# produces and refused everything else for want of a "Question ID" column.
# People fill in the document they were given, so their work was retyped.
#
# The fixtures are the real thing rather than a simplified stand-in:
#
#   Beryl_Systems_Engineering_Appraisal_2026.xlsm         the blank form
#   Beryl_Systems_Engineering_Appraisal_2026_filled.xlsm  the same file, saved
#                                                         with a full year of
#                                                         answers typed in
#
# The filled copy is the blank one with cells written into its sheet XML, so it
# is the same document in every other respect — same styles, same SUMPRODUCT
# formulas, same macro-enabled container.
RSpec.describe "Api::V1::Appraisals filled workbook import", type: :request do
  before do
    post "/api/v1/auth/register",
         params: {
           companyName: "Filled Corp", firstName: "Ada", lastName: "Admin",
           email: "filled.admin@acme.test", password: "correct-horse-battery-1",
           passwordConfirmation: "correct-horse-battery-1"
         }.to_json,
         headers: { "Content-Type" => "application/json" }
  end

  let(:company) { Company.find_by!(name: "Filled Corp") }
  let(:json_headers) { { "Content-Type" => "application/json" } }

  BLANK = Rails.root.join("spec/fixtures/files/Beryl_Systems_Engineering_Appraisal_2026.xlsm").freeze
  FILLED = Rails.root.join("spec/fixtures/files/Beryl_Systems_Engineering_Appraisal_2026_filled.xlsm").freeze
  XLSM_TYPE = "application/vnd.ms-excel.sheet.macroEnabled.12".freeze

  def in_tenant(&) = ActsAsTenant.with_tenant(company, &)
  def role(slug) = in_tenant { company.roles.find_by!(slug: slug) }
  def body = response.parsed_body["data"]

  def upload_file(path, filename: File.basename(path))
    Rack::Test::UploadedFile.new(path.to_s, XLSM_TYPE, original_filename: filename)
  end

  def login(email)
    post "/api/v1/auth/login",
         params: { email: email, password: "correct-horse-battery-1" }.to_json, headers: json_headers
  end

  def login_admin = login("filled.admin@acme.test")

  def staff(email:, first_name:, last_name:)
    in_tenant do
      user = create(:user, company: company, email_address: email, password: "correct-horse-battery-1")
      create(:user_role, user: user, role: role("employee"), company: company)
      create(:employee, company: company, user: user, first_name: first_name, last_name: last_name)
    end
  end

  def import_template(path)
    login_admin
    post "/api/v1/appraisal_templates/import_preview", params: { file: upload_file(path) }
    body
  end

  # The workbook, imported and saved as a real template, exactly as the builder
  # does it. Lenses are assigned here because the workbook deliberately doesn't
  # map areas to perspectives and activation requires one per category.
  def template_from(preview, name: "Engineering 2026", extra_sections: [], drop_fields: [])
    sections = Array(preview["wizardSections"]).map do |section|
      next section if drop_fields.empty?

      section.merge("fields" => section["fields"].reject { |field| drop_fields.include?(field["key"]) })
    end
    sections += extra_sections

    post "/api/v1/appraisal_templates",
         params: {
           name: name, status: "draft",
           structure: {
             assessmentPeriod: preview["assessmentPeriod"],
             perspectives: preview["perspectives"],
             developmentFields: preview["developmentFields"],
             finalReviewFields: preview["finalReviewFields"],
             ratingGuide: preview["ratingGuide"],
             wizardSections: sections
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

    id = body["id"]
    patch "/api/v1/appraisal_templates/#{id}/activate", params: {}.to_json, headers: json_headers
    in_tenant { AppraisalTemplate.find(id) }
  end

  # Template → cycle → started → one appraisal sitting at the self stage.
  def appraisal_for(template)
    manager = staff(email: "boss@acme.test", first_name: "Anita", last_name: "Desai")
    employee = staff(email: "priya@acme.test", first_name: "Priya", last_name: "Raman")
    in_tenant { employee.assign_managers!("primary" => manager.id, "final" => manager.id) }

    login_admin
    post "/api/v1/appraisal_cycles",
         params: {
           name: "FY26", appraisalTemplateId: template.id, eligibleEmployeeIds: [ employee.id ]
         }.to_json, headers: json_headers
    cycle_id = body["id"]
    post "/api/v1/appraisal_cycles/#{cycle_id}/start", params: {}.to_json, headers: json_headers

    in_tenant { Appraisal.find_by!(appraisal_cycle_id: cycle_id, employee_id: employee.id) }
  end

  # Field keys ride in value position precisely so the API's camelising layer
  # can't touch them; this is only for readable assertions.
  def responses_by_key(preview)
    Array(preview["responses"]).to_h { |entry| [ entry["key"], entry["value"] ] }
  end

  def import_into(appraisal, path)
    post "/api/v1/appraisals/#{appraisal.id}/import_preview", params: { file: upload_file(path) }
    body
  end

  # The ordinary setup: the real workbook, imported and started, and the
  # employee logged in ready to hand their copy back.
  def ready_appraisal(**template_options)
    template = template_from(import_template(BLANK), **template_options)
    appraisal = appraisal_for(template)
    login("priya@acme.test")
    [ appraisal, template ]
  end

  # --- Template import: blank and filled must agree --------------------------

  describe "importing the workbook as a template" do
    it "reads the blank form's whole structure" do
      preview = import_template(BLANK)

      expect(response).to have_http_status(:ok)
      expect(preview["layout"]).to eq("sectioned")
      expect(preview["categories"].size).to eq(7)
      expect(preview["wizardSections"].map { |section| section["key"] })
        .to eq(%w[perspectives development final_review])
    end

    it "reads a FILLED copy to exactly the same structure" do
      blank = import_template(BLANK)
      filled = import_template(FILLED)

      expect(response).to have_http_status(:ok)

      # The structure is the form, and somebody's answers are not part of it.
      # An Admin who imports a completed appraisal by mistake — which happens,
      # because the completed one is the copy lying around — must get the same
      # template, not one with a stranger's ratings baked into it.
      structural = ->(preview) {
        preview.slice("layout", "totalWeight", "questionCount", "weightsValid")
               .merge(
                 "categories" => preview["categories"].map { |c| c.slice("name", "weight", "description") },
                 "sections" => preview["wizardSections"].map { |s|
                   { s["key"] => s["fields"].map { |f| f["key"] } }
                 }
               )
      }

      expect(structural.call(filled)).to eq(structural.call(blank))
    end

    it "carries the filled cells through the preview instead of discarding them" do
      preview = import_template(FILLED)

      # Read and reported — an Admin previewing a filled workbook can see what
      # was in it. Nothing here is silently turned into template content.
      first = preview["categories"].first
      expect(first["captures"]["selfRating"]).to eq("5")
      expect(first["captures"]["selfComments"]).to match(/billing service/i)

      expect(preview["employeeFields"]["fields"].find { |f| f["key"] == "employee_name" }["value"])
        .to eq("Priya Raman")
      expect(preview["developmentFields"].find { |f| f["key"] == "key_strengths" }["value"])
        .to match(/debugging/i)
    end

    it "does not report the filled workbook's answers as rows it failed to understand" do
      expect(import_template(FILLED)["unmappedRows"]).to eq([])
    end
  end

  # --- Appraisal import: the employee hands their copy back ------------------

  describe "uploading a blank workbook against an appraisal" do
    it "recognises every performance area and leaves the ratings unanswered" do
      appraisal, = ready_appraisal
      preview = import_into(appraisal, BLANK)

      expect(response).to have_http_status(:ok)
      expect(preview["layout"]).to eq("full_form")
      expect(preview["rows"].size).to eq(7)
      expect(preview["rows"].map { |row| row["rating"] }).to all(be_nil)
      expect(preview["answeredCount"]).to eq(0)
      # A blank form is not a broken one.
      expect(preview["invalidCount"]).to eq(0)
      expect(preview["unmatched"]).to eq([])
    end
  end

  describe "uploading a FILLED workbook against an appraisal" do
    it "maps every rating and its evidence onto the template's own questions" do
      appraisal, template = ready_appraisal
      preview = import_into(appraisal, FILLED)

      expect(response).to have_http_status(:ok)
      expect(preview["layout"]).to eq("full_form")
      expect(preview["rows"].size).to eq(7)
      expect(preview["answeredCount"]).to eq(7)
      expect(preview["invalidCount"]).to eq(0)

      # Bound to real question ids, so the preview can be submitted through the
      # ordinary path with no further matching.
      ids = in_tenant { template.questions.pluck(:id) }
      expect(preview["rows"].map { |row| row["questionId"] }).to match_array(ids)

      expect(preview["rows"].map { |row| row["rating"] }).to eq([ 5, 4, 5, 4, 4, 4, 5 ])
      expect(preview["rows"].first["prompt"]).to eq("Technical Skills & Code Quality")
      expect(preview["rows"].first["comment"]).to match(/p95 latency/i)
    end

    it "imports the employee's own columns and never the manager's" do
      appraisal, = ready_appraisal
      preview = import_into(appraisal, FILLED)

      row = preview["rows"].find { |r| r["prompt"] == "Ownership & Accountability" }

      # Self 5, manager 4 in that row of the workbook. Both are read — nothing
      # is discarded — but only the employee's becomes their answer.
      expect(row["selfRating"]).to eq(5)
      expect(row["managerRating"]).to eq(4)
      expect(row["rating"]).to eq(5)
      expect(row["comment"]).to match(/on-call rota/i)
    end

    it "maps the development and final-review prose onto the template's field keys" do
      appraisal, = ready_appraisal
      responses = responses_by_key(import_into(appraisal, FILLED))

      expect(responses["key_achievements_contributions"]).to match(/Billing rewrite/)
      expect(responses["key_strengths"]).to match(/Debugging/)
      expect(responses["areas_for_improvement"]).to match(/Delegating/)
      expect(responses["skills_training_required_for_next_12_months"]).to match(/System design/)
      expect(responses["next_year_goals_increased_responsibilities"]).to match(/payments domain/)
      expect(responses["overall_performance_rating"]).to eq("Strong")
      expect(responses["employee_final_comments"]).to match(/Happy with the review/)
    end

    it "keeps field keys intact through the API's camelising layer" do
      appraisal, = ready_appraisal
      keys = import_into(appraisal, FILLED)["responses"].map { |entry| entry["key"] }

      # The preview is camelised wholesale on the way out. A field key is not
      # a JSON property name and must survive that untouched, or it matches
      # nothing on the form it came from.
      expect(keys).to include("key_achievements_contributions")
      expect(keys).to all(match(/\A[a-z0-9_]+\z/))
    end

    it "maps the perspective assessments under the keys a revision stores them by" do
      appraisal, = ready_appraisal
      responses = responses_by_key(import_into(appraisal, FILLED))

      expect(responses["past_performance__manager_rating"]).to eq("5")
      expect(responses["past_performance__manager_summary"]).to match(/demanding roadmap/i)
      expect(responses["future_readiness__manager_rating"]).to eq("4")
    end

    it "reports the employee details the workbook carried rather than dropping them" do
      appraisal, = ready_appraisal
      fields = import_into(appraisal, FILLED)["employeeFields"]

      expect(fields.find { |f| f["key"] == "employee_name" }["value"]).to eq("Priya Raman")
      expect(fields.find { |f| f["key"] == "job_title" }["value"]).to eq("Senior Software Engineer")
    end

    it "writes nothing — the preview is a preview" do
      appraisal, = ready_appraisal

      expect { import_into(appraisal, FILLED) }.not_to change { in_tenant { AppraisalRevision.count } }
      expect { import_into(appraisal, FILLED) }.not_to change { in_tenant { AppraisalAnswer.count } }
    end

    it "still accepts the answer sheet the Export button produces" do
      appraisal, template = ready_appraisal
      ids = in_tenant { template.questions.order(:id).pluck(:id) }

      file = Tempfile.new([ "answers", ".csv" ])
      file.write("Question ID,Question,Rating,Comments\n#{ids.first},Anything,4,Solid evidence\n")
      file.rewind
      post "/api/v1/appraisals/#{appraisal.id}/import_preview",
           params: { file: Rack::Test::UploadedFile.new(file.path, "text/csv", original_filename: "answers.csv") }

      expect(response).to have_http_status(:ok)
      expect(body["layout"]).to eq("answer_sheet")
      expect(body["rows"].first["rating"]).to eq(4)
    end
  end

  # --- Drift between the workbook and the template ---------------------------

  describe "when the template has a field the workbook does not" do
    it "names it as missing and imports everything else" do
      # A field added to the template after this workbook was handed out.
      extra = [ {
        "key" => "extra", "kind" => "long_text", "title" => "Wellbeing",
        "fields" => [ { "key" => "how_is_your_workload", "label" => "How is your workload?", "input" => "textarea" } ]
      } ]
      appraisal, = ready_appraisal(extra_sections: extra)
      preview = import_into(appraisal, FILLED)

      expect(response).to have_http_status(:ok)
      expect(preview["missingFields"].map { |field| field["key"] }).to include("how_is_your_workload")
      # An added field is not a reason to reject the rest of the document.
      expect(responses_by_key(preview)["key_strengths"]).to match(/Debugging/)
      expect(preview["answeredCount"]).to eq(7)
    end
  end

  describe "when the workbook has a field the template no longer does" do
    it "names what had nowhere to go instead of silently dropping it" do
      # Two fields removed from the template after this workbook was filled in.
      appraisal, = ready_appraisal(drop_fields: %w[key_strengths past_performance])
      preview = import_into(appraisal, FILLED)

      expect(response).to have_http_status(:ok)
      labels = preview["unmatched"].map { |entry| entry["label"] }
      expect(labels).to include("Key Strengths", "Past Performance")
      expect(preview["unmatched"].first["reason"]).to match(/nowhere to go/)

      # Reported, and therefore NOT imported under a key nothing reads.
      expect(responses_by_key(preview)).not_to have_key("key_strengths")
      # The rest still lands.
      expect(responses_by_key(preview)["areas_for_improvement"]).to match(/Delegating/)
    end

    it "says so when a performance area the workbook rated is gone from the template" do
      preview = import_template(BLANK)
      # Drop the last area, then re-import the filled workbook, which rates it.
      preview["categories"] = preview["categories"][0..-2]
      preview["categories"].last["weight"] = 20.0

      login_admin
      template = template_from(preview, name: "Six areas")
      appraisal = appraisal_for(template)
      login("priya@acme.test")

      result = import_into(appraisal, FILLED)

      expect(result["rows"].size).to eq(6)
      expect(result["unmatched"].map { |entry| entry["label"] }).to include("Business & Client Impact")
    end
  end

  # --- .xlsm specifically ----------------------------------------------------

  describe ".xlsm handling" do
    it "reads a macro-enabled workbook on both import paths" do
      # Roo has no .xlsm reader; both importers map the extension to xlsx. If
      # that ever regresses, every real upload this product receives breaks,
      # because the company form IS an .xlsm.
      expect(File.extname(FILLED.to_s)).to eq(".xlsm")

      expect(import_template(FILLED)["layout"]).to eq("sectioned")

      appraisal, = ready_appraisal
      expect(import_into(appraisal, FILLED)["layout"]).to eq("full_form")
    end

    it "still refuses a file that is not a spreadsheet at all" do
      appraisal, = ready_appraisal
      file = Tempfile.new([ "notes", ".txt" ])
      file.write("not a workbook")
      file.rewind

      post "/api/v1/appraisals/#{appraisal.id}/import_preview",
           params: { file: Rack::Test::UploadedFile.new(file.path, "text/plain", original_filename: "notes.txt") }

      expect(response).to have_http_status(:unprocessable_content)
    end
  end
end

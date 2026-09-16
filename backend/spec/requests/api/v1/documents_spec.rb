require "rails_helper"

RSpec.describe "Api::V1::Documents", type: :request do
  # Registering makes an admin (all permissions) plus the 4 default roles, so
  # the "employee" role below is the real seeded one rather than a hand-built
  # approximation of it.
  before do
    post "/api/v1/auth/register",
         params: {
           companyName: "Docs Corp",
           firstName: "Admin",
           lastName: "User",
           email: "docs.admin@acme.test",
           password: "correct-horse-battery-1",
           passwordConfirmation: "correct-horse-battery-1"
         }.to_json,
         headers: { "Content-Type" => "application/json" }
  end

  let(:company) { Company.find_by!(name: "Docs Corp") }
  let(:employee_role) { ActsAsTenant.with_tenant(company) { company.roles.find_by!(slug: "employee") } }

  # A staff login with the seeded "employee" role and an Employee row of their own.
  def sign_in_employee(email:)
    user = ActsAsTenant.with_tenant(company) do
      u = create(:user, company: company, email_address: email, password: "correct-horse-battery-1")
      create(:user_role, user: u, role: employee_role, company: company)
      create(:employee, company: company, user: u)
      u
    end

    post "/api/v1/auth/login",
         params: { email: email, password: "correct-horse-battery-1" }.to_json,
         headers: { "Content-Type" => "application/json" }

    user
  end

  def upload(employee_id:, category: "aadhaar", custom_category: nil)
    params = {
      file: Rack::Test::UploadedFile.new(StringIO.new("%PDF-1.4 x"), "application/pdf", original_filename: "Aadhaar.pdf"),
      document_type: category
    }
    params[:employee_id] = employee_id if employee_id
    params[:custom_category] = custom_category if custom_category

    post "/api/v1/documents", params: params
  end

  describe "categories" do
    it "stores the chosen category against the record" do
      employee = ActsAsTenant.with_tenant(company) { create(:employee, company: company) }

      upload(employee_id: employee.id, category: "offer_letter")

      expect(response).to have_http_status(:created)
      expect(response.parsed_body.dig("data", "documentType")).to eq("offer_letter")
    end

    it "refuses a category that isn't on the list" do
      employee = ActsAsTenant.with_tenant(company) { create(:employee, company: company) }

      upload(employee_id: employee.id, category: "Payslip")

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "keeps the typed name alongside the Other category" do
      employee = ActsAsTenant.with_tenant(company) { create(:employee, company: company) }

      upload(employee_id: employee.id, category: "other", custom_category: "Gym membership")

      expect(response).to have_http_status(:created)
      body = response.parsed_body["data"]
      expect(body["documentType"]).to eq("other")
      expect(body["customCategory"]).to eq("Gym membership")
    end

    it "refuses Other with no name" do
      employee = ActsAsTenant.with_tenant(company) { create(:employee, company: company) }

      upload(employee_id: employee.id, category: "other")

      expect(response).to have_http_status(:unprocessable_entity)
    end

    # The client never sent one, which made every upload fail outright.
    it "names the document after the file when no title is given" do
      employee = ActsAsTenant.with_tenant(company) { create(:employee, company: company) }

      upload(employee_id: employee.id)

      expect(response).to have_http_status(:created)
      expect(response.parsed_body.dig("data", "title")).to eq("Aadhaar.pdf")
    end
  end

  describe "one employee against another" do
    it "never lists a colleague's documents" do
      mine = sign_in_employee(email: "mine@acme.test").employee_record
      colleague = ActsAsTenant.with_tenant(company) { create(:employee, company: company) }
      ActsAsTenant.with_tenant(company) do
        Document.create!(company: company, employee: colleague, uploaded_by: mine.user,
                         title: "Theirs.pdf", document_type: "pan")
      end

      # Asking for the colleague's id explicitly must still return nothing:
      # the filter narrows an already-scoped list, it cannot widen it.
      get "/api/v1/documents", params: { employeeId: colleague.id }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["data"]).to be_empty
    end

    it "refuses an upload filed against a colleague" do
      sign_in_employee(email: "uploader@acme.test")
      colleague = ActsAsTenant.with_tenant(company) { create(:employee, company: company) }

      upload(employee_id: colleague.id)

      expect(response).to have_http_status(:forbidden)
    end

    it "allows an upload against their own record" do
      mine = sign_in_employee(email: "self@acme.test").employee_record

      upload(employee_id: mine.id)

      expect(response).to have_http_status(:created)
      expect(response.parsed_body.dig("data", "employeeId").to_s).to eq(mine.id.to_s)
    end

    # upload_own is a write right only — it must not let them file a
    # company-wide document either.
    it "refuses an upload with no employee at all" do
      sign_in_employee(email: "nobody@acme.test")

      upload(employee_id: nil)

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "deleting your own upload" do
    it "removes a document the employee uploaded themselves" do
      mine = sign_in_employee(email: "fixer@acme.test").employee_record
      upload(employee_id: mine.id)
      document_id = response.parsed_body.dig("data", "id")

      delete "/api/v1/documents/#{document_id}"

      expect(response).to have_http_status(:no_content)
      expect(Document.unscoped.exists?(document_id)).to be false
    end

    it "refuses a document on their record that HR uploaded" do
      user = sign_in_employee(email: "contracted@acme.test")
      hr_upload = ActsAsTenant.with_tenant(company) do
        Document.create!(company: company, employee: user.employee_record,
                         uploaded_by: User.find_by!(email_address: "docs.admin@acme.test"),
                         title: "Signed contract.pdf", document_type: "employment_contract")
      end

      delete "/api/v1/documents/#{hr_upload.id}"

      expect(response).to have_http_status(:forbidden)
      expect(Document.unscoped.exists?(hr_upload.id)).to be true
    end
  end

  describe "preview" do
    it "serves the file inline, and lets the app frame just this response" do
      employee = ActsAsTenant.with_tenant(company) { create(:employee, company: company) }
      upload(employee_id: employee.id)
      document_id = response.parsed_body.dig("data", "id")

      get "/api/v1/documents/#{document_id}/preview"

      expect(response).to have_http_status(:ok)
      expect(response.headers["Content-Disposition"]).to start_with("inline")
      expect(response.media_type).to eq("application/pdf")
      expect(response.headers["X-Frame-Options"]).to be_nil

      get "/api/v1/documents/#{document_id}/download"

      expect(response.headers["Content-Disposition"]).to start_with("attachment")
      expect(response.headers["X-Frame-Options"]).to eq("DENY")
    end
  end
end

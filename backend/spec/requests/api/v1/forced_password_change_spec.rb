require "rails_helper"

# Admin can tick "require a password change" when inviting somebody. While that
# is outstanding the account can sign in and do nothing else.
#
# The enforcement is deliberately server-side. A rule the frontend applies by
# refusing to route somewhere is not a rule — the API is reachable directly,
# and this flag exists precisely for accounts whose credentials are in doubt.
# So these check the API, not the screen.
RSpec.describe "Forced password change", type: :request do
  include ActiveJob::TestHelper

  let(:json_headers) { { "Content-Type" => "application/json" } }
  let(:company) { Company.find_by!(name: "Force Corp") }
  let(:admin_password) { "correct-horse-battery-1" }

  def in_tenant(&) = ActsAsTenant.with_tenant(company, &)
  def body = response.parsed_body["data"]
  def errors = response.parsed_body["errors"]

  before do
    ActionMailer::Base.deliveries.clear
    post "/api/v1/auth/register",
         params: {
           companyName: "Force Corp", firstName: "Ada", lastName: "Admin",
           email: "force.admin@acme.test", password: admin_password,
           passwordConfirmation: admin_password
         }.to_json, headers: json_headers
  end

  def login(email, password)
    post "/api/v1/auth/login", params: { email: email, password: password }.to_json, headers: json_headers
  end

  def login_admin = login("force.admin@acme.test", admin_password)

  def invited_employee(force:)
    login_admin
    post "/api/v1/employees",
         params: { employeeCode: "F-1", firstName: "Noor", lastName: "Haddad", workEmail: "noor@acme.test" }.to_json,
         headers: json_headers
    employee = in_tenant { Employee.find(body["id"]) }

    post "/api/v1/employees/#{employee.id}/invite",
         params: { forcePasswordChange: force }.to_json, headers: json_headers
    employee
  end

  def accept_invitation(employee, password)
    perform_enqueued_jobs
    text = (ActionMailer::Base.deliveries.last.all_parts.presence || [ ActionMailer::Base.deliveries.last ])
             .map { |part| part.body.to_s }.join("\n")
    token = text[%r{accept-invitation\?token=([^\s"'<]+)}, 1]
    post "/api/v1/auth/accept_invitation",
         params: { token: token, password: password, passwordConfirmation: password }.to_json,
         headers: json_headers
    employee
  end

  # --- The checkbox itself ---------------------------------------------------

  describe "inviting with the box ticked" do
    it "records the requirement on the account and says so to the admin" do
      employee = invited_employee(force: true)

      expect(response).to have_http_status(:ok)
      expect(in_tenant { employee.reload.user.must_change_password }).to be(true)
      expect(body["employee"]["user"]["mustChangePassword"]).to be(true)
      expect(body["message"]).to match(/set a new password before they can use the app/i)
    end
  end

  describe "inviting with the box unticked" do
    it "leaves the employee free to change it whenever they like" do
      employee = invited_employee(force: false)

      expect(in_tenant { employee.reload.user.must_change_password }).to be(false)
      expect(body["employee"]["user"]["mustChangePassword"]).to be(false)
      expect(body["message"]).not_to match(/before they can use the app/i)
    end

    it "is the default when the checkbox isn't sent at all" do
      login_admin
      post "/api/v1/employees",
           params: { employeeCode: "F-2", firstName: "Sam", lastName: "Okoye", workEmail: "sam@acme.test" }.to_json,
           headers: json_headers
      employee = in_tenant { Employee.find(body["id"]) }

      post "/api/v1/employees/#{employee.id}/invite", params: {}.to_json, headers: json_headers

      expect(in_tenant { employee.reload.user.must_change_password }).to be(false)
    end

    it "does not drop an existing requirement when the invitation is re-sent" do
      employee = invited_employee(force: true)

      login_admin
      post "/api/v1/employees/#{employee.id}/invite", params: {}.to_json, headers: json_headers

      # Omitting the field means "leave it alone", not "turn it off" — a
      # resend is about the link, and shouldn't quietly waive the requirement.
      expect(in_tenant { employee.reload.user.must_change_password }).to be(true)
    end
  end

  # --- What the link does, which is the whole point of the checkbox ---------

  describe "opening the invitation link" do
    def invitation_token
      perform_enqueued_jobs
      text = (ActionMailer::Base.deliveries.last.all_parts.presence || [ ActionMailer::Base.deliveries.last ])
               .map { |part| part.body.to_s }.join("\n")
      text[%r{accept-invitation\?token=([^\s"'<]+)}, 1]
    end

    context "when the admin did NOT force a change" do
      let!(:employee) { invited_employee(force: false) }

      it "says no password is needed, so the page knows not to ask" do
        get "/api/v1/auth/invitation", params: { token: invitation_token }

        expect(body["mustSetPassword"]).to be(false)
      end

      it "signs them straight in without one" do
        post "/api/v1/auth/accept_invitation",
             params: { token: invitation_token }.to_json, headers: json_headers

        expect(response).to have_http_status(:created)
        expect(body.dig("user", "email")).to eq("noor@acme.test")
        expect(in_tenant { employee.reload.user }).to be_active
      end

      it "drops them into the app, not onto a change-password screen" do
        post "/api/v1/auth/accept_invitation",
             params: { token: invitation_token }.to_json, headers: json_headers

        get "/api/v1/auth/me"
        expect(body["mustChangePassword"]).to be(false)

        get "/api/v1/employees"
        expect(response).to have_http_status(:ok)
      end

      it "still accepts a password if one is offered anyway" do
        post "/api/v1/auth/accept_invitation",
             params: { token: invitation_token, password: "chosen-anyway-1", passwordConfirmation: "chosen-anyway-1" }.to_json,
             headers: json_headers

        expect(response).to have_http_status(:created)
        expect(in_tenant { employee.reload.user.authenticate("chosen-anyway-1") }).to be_truthy
      end

      it "spends the link either way" do
        token = invitation_token
        post "/api/v1/auth/accept_invitation", params: { token: token }.to_json, headers: json_headers
        delete "/api/v1/auth/logout"

        post "/api/v1/auth/accept_invitation", params: { token: token }.to_json, headers: json_headers
        expect(response).to have_http_status(:unprocessable_content)
      end
    end

    context "when the admin DID force a change" do
      let!(:employee) { invited_employee(force: true) }

      it "says a password is needed" do
        get "/api/v1/auth/invitation", params: { token: invitation_token }

        expect(body["mustSetPassword"]).to be(true)
      end

      it "refuses to spend the link without one" do
        post "/api/v1/auth/accept_invitation",
             params: { token: invitation_token }.to_json, headers: json_headers

        expect(response).to have_http_status(:unprocessable_content)
        expect(errors.first["code"]).to eq("password_required")
        expect(in_tenant { employee.reload.user }).to be_invited
      end

      it "leaves the link usable after that refusal" do
        token = invitation_token
        post "/api/v1/auth/accept_invitation", params: { token: token }.to_json, headers: json_headers

        post "/api/v1/auth/accept_invitation",
             params: { token: token, password: "now-chosen-1", passwordConfirmation: "now-chosen-1" }.to_json,
             headers: json_headers
        expect(response).to have_http_status(:created)
      end

      it "clears the requirement once they choose one, so they are not asked twice" do
        post "/api/v1/auth/accept_invitation",
             params: { token: invitation_token, password: "now-chosen-1", passwordConfirmation: "now-chosen-1" }.to_json,
             headers: json_headers

        expect(in_tenant { employee.reload.user.must_change_password }).to be(false)
        get "/api/v1/employees"
        expect(response).to have_http_status(:ok)
      end
    end
  end

  # --- What the flag actually does ------------------------------------------

  # Setting a password AT the invitation link satisfies the requirement, so the
  # invite flow never lands anybody here. What does is the flag being true on an
  # account that is already signed in — so that is what these set up. The gate
  # is the backstop that makes the flag mean something wherever it comes from.
  describe "an employee who owes a password change" do
    let!(:employee) do
      e = accept_invitation(invited_employee(force: false), "first-chosen-pass-1")
      in_tenant { e.reload.user.update!(must_change_password: true) }
      e
    end

    it "can sign in" do
      expect(response).to have_http_status(:created)
    end

    it "is told so by /auth/me, which is how the UI knows to show the screen" do
      get "/api/v1/auth/me"

      expect(response).to have_http_status(:ok)
      expect(body["mustChangePassword"]).to be(true)
    end

    it "is refused everywhere else, with a code the client can act on" do
      get "/api/v1/employees"

      expect(response).to have_http_status(:forbidden)
      expect(errors.first["code"]).to eq("password_change_required")
    end

    it "is refused on writes too, not just reads" do
      post "/api/v1/departments", params: { name: "Sneaky" }.to_json, headers: json_headers

      expect(response).to have_http_status(:forbidden)
      expect(errors.first["code"]).to eq("password_change_required")
    end

    it "can still sign out — being stuck must not mean trapped" do
      delete "/api/v1/auth/logout"

      expect(response).to have_http_status(:no_content)
    end

    it "can change the password, which is the one thing it is being asked to do" do
      patch "/api/v1/auth/change_password",
            params: {
              currentPassword: "first-chosen-pass-1",
              newPassword: "second-chosen-pass-2",
              newPasswordConfirmation: "second-chosen-pass-2"
            }.to_json, headers: json_headers

      expect(response).to have_http_status(:ok)
    end

    it "is let through everywhere once it has" do
      patch "/api/v1/auth/change_password",
            params: {
              currentPassword: "first-chosen-pass-1",
              newPassword: "second-chosen-pass-2",
              newPasswordConfirmation: "second-chosen-pass-2"
            }.to_json, headers: json_headers

      expect(in_tenant { employee.reload.user.must_change_password }).to be(false)

      get "/api/v1/auth/me"
      expect(body["mustChangePassword"]).to be(false)

      get "/api/v1/employees"
      expect(response).to have_http_status(:ok)
    end

    it "stays blocked if the change is rejected" do
      patch "/api/v1/auth/change_password",
            params: {
              currentPassword: "wrong-password",
              newPassword: "second-chosen-pass-2",
              newPasswordConfirmation: "second-chosen-pass-2"
            }.to_json, headers: json_headers
      expect(response).to have_http_status(:unprocessable_content)

      get "/api/v1/employees"
      expect(response).to have_http_status(:forbidden)
      expect(in_tenant { employee.reload.user.must_change_password }).to be(true)
    end

    it "is cleared by the forgot-password route as well, since that is also choosing one" do
      delete "/api/v1/auth/logout"
      user = in_tenant { employee.reload.user }

      post "/api/v1/auth/reset_password",
           params: {
             token: user.password_reset_token,
             password: "reset-chosen-pass-3", passwordConfirmation: "reset-chosen-pass-3"
           }.to_json, headers: json_headers

      expect(response).to have_http_status(:ok)
      expect(in_tenant { employee.reload.user.must_change_password }).to be(false)
    end
  end

  describe "an employee who does not owe one" do
    it "goes straight through to the app" do
      accept_invitation(invited_employee(force: false), "first-chosen-pass-1")

      get "/api/v1/auth/me"
      expect(body["mustChangePassword"]).to be(false)

      get "/api/v1/employees"
      expect(response).to have_http_status(:ok)
    end
  end
end

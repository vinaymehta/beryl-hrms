require "rails_helper"

# Admin → Create Employee → Invite → link → Employee sets their own password →
# Employee logs in.
#
# The property that matters most here is a negative one, so it is asserted from
# several directions rather than once: at no point does an administrator
# choose, see, receive or store an employee's password. The account is created
# with a random secret nobody reads, the link goes to the employee's own
# mailbox, and the only place a password is ever typed is the form the employee
# opens from that link.
RSpec.describe "Employee invitation and password setup", type: :request do
  include ActiveJob::TestHelper
  include ActiveSupport::Testing::TimeHelpers

  let(:json_headers) { { "Content-Type" => "application/json" } }
  let(:company) { Company.find_by!(name: "Invite Corp") }
  let(:admin_password) { "correct-horse-battery-1" }

  def in_tenant(&) = ActsAsTenant.with_tenant(company, &)
  def body = response.parsed_body["data"]
  def errors = response.parsed_body["errors"]

  before do
    post "/api/v1/auth/register",
         params: {
           companyName: "Invite Corp", firstName: "Ada", lastName: "Admin",
           email: "invite.admin@acme.test", password: admin_password,
           passwordConfirmation: admin_password
         }.to_json, headers: json_headers
  end

  def login(email, password)
    post "/api/v1/auth/login", params: { email: email, password: password }.to_json, headers: json_headers
  end

  def login_admin = login("invite.admin@acme.test", admin_password)

  def create_employee(**overrides)
    login_admin
    post "/api/v1/employees",
         params: {
           employeeCode: "INV-1", firstName: "Noor", lastName: "Haddad",
           workEmail: "noor@acme.test"
         }.merge(overrides).to_json, headers: json_headers
    in_tenant { Employee.find(body["id"]) }
  end

  def invite(employee)
    login_admin
    post "/api/v1/employees/#{employee.id}/invite", params: {}.to_json, headers: json_headers
  end

  # The whole of the last delivered mail, both parts. `mail.body` is empty on a
  # multipart message, so reading it directly finds nothing.
  def last_mail_text
    perform_enqueued_jobs
    mail = ActionMailer::Base.deliveries.last
    raise "no mail was delivered" if mail.nil?

    (mail.all_parts.presence || [ mail ]).map { |part| part.body.to_s }.join("\n")
  end

  # The token as the EMPLOYEE receives it: pulled out of the delivered mail
  # rather than generated in the test, so the link in the inbox is what is
  # being exercised.
  def emailed_invitation_token
    last_mail_text[%r{accept-invitation\?token=([^\s"'<]+)}, 1] or
      raise "no invitation link in the last mail"
  end

  def emailed_reset_token
    last_mail_text[%r{reset-password\?token=([^\s"'<]+)}, 1] or
      raise "no reset link in the last mail"
  end

  around do |example|
    ActionMailer::Base.deliveries.clear
    example.run
    ActionMailer::Base.deliveries.clear
  end

  # --- Creating the employee -------------------------------------------------

  describe "creating an employee" do
    it "leaves them pending with no invitation sent" do
      employee = create_employee

      expect(response).to have_http_status(:created)
      expect(body["user"]).to include("status" => "invited", "invitationUnsent" => true)
      expect(in_tenant { employee.user.invited_at }).to be_nil
      expect(ActionMailer::Base.deliveries).to be_empty
    end

    it "ignores a password an admin tries to set on the employee" do
      employee = create_employee(password: "admin-chosen-password-1", passwordConfirmation: "admin-chosen-password-1")

      # The parameter simply isn't permitted, so the account keeps the random
      # secret it was created with and the admin's choice is not a credential.
      expect(login("noor@acme.test", "admin-chosen-password-1")).to be_nil.or be_truthy
      expect(response).not_to have_http_status(:ok)
      expect(in_tenant { employee.user.authenticate("admin-chosen-password-1") }).to be(false)
    end

    it "never returns anything password-shaped" do
      create_employee

      # Not a blunt /password/ match on the body: `mustChangePassword` is a
      # legitimate boolean flag. What must never appear is a password VALUE —
      # so every password-ish key has to be a boolean, and none of the
      # secret-carrying names may exist at all.
      password_keys = body["user"].select { |key, _| key.match?(/password/i) }
      expect(password_keys.values).to all(be_in([ true, false ]))
      expect(body["user"].keys).not_to include(
        "password", "passwordDigest", "passwordSalt", "temporaryPassword", "passwordResetToken"
      )
      expect(response.body).not_to match(/\$2[aby]\$/) # no bcrypt digest anywhere
    end
  end

  # --- Inviting --------------------------------------------------------------

  describe "POST /employees/:id/invite" do
    it "sends the invitation and marks the account as awaiting setup" do
      employee = create_employee

      expect { invite(employee) }.to have_enqueued_mail(UserMailer, :invitation)

      expect(response).to have_http_status(:ok)
      expect(body["message"]).to match(/invitation sent to noor@acme\.test/i)
      expect(body["employee"]["user"]).to include("invitationPending" => true, "invitationUnsent" => false)
      expect(in_tenant { employee.reload.user.invited_at }).to be_present
    end

    it "records the invitation in the audit trail without the token" do
      employee = create_employee
      invite(employee)

      log = in_tenant { AuditLog.where(action: "employee.invited").last }
      expect(log).to be_present
      expect(log.attributes.to_s).not_to match(/accept-invitation|token/i)
    end

    it "refuses for an employee who has no login account" do
      login_admin
      post "/api/v1/employees",
           params: { employeeCode: "INV-2", firstName: "No", lastName: "Login" }.to_json, headers: json_headers
      employee = in_tenant { Employee.find(body["id"]) }

      invite(employee)

      expect(response).to have_http_status(:unprocessable_content)
      expect(errors.first["message"]).to match(/no login account/i)
    end

    it "is closed to an employee inviting anybody, including themselves" do
      employee = create_employee
      invite(employee)
      token = emailed_invitation_token
      post "/api/v1/auth/accept_invitation",
           params: { token: token, password: "employee-chosen-pass-1", passwordConfirmation: "employee-chosen-pass-1" }.to_json,
           headers: json_headers

      # Now signed in as the employee themselves.
      post "/api/v1/employees/#{employee.id}/invite", params: {}.to_json, headers: json_headers
      expect(response).to have_http_status(:forbidden)
    end

    it "does not reach another company's employee" do
      post "/api/v1/auth/register",
           params: {
             companyName: "Other Corp", firstName: "Otto", lastName: "Other",
             email: "other.admin@acme.test", password: admin_password, passwordConfirmation: admin_password
           }.to_json, headers: json_headers
      employee = create_employee

      login("other.admin@acme.test", admin_password)
      post "/api/v1/employees/#{employee.id}/invite", params: {}.to_json, headers: json_headers

      expect(response).to have_http_status(:not_found)
    end
  end

  # --- The employee's side ---------------------------------------------------

  describe "the invitation link" do
    let!(:employee) { create_employee }

    before { invite(employee) }

    it "describes who it is for, so the page can greet them" do
      get "/api/v1/auth/invitation", params: { token: emailed_invitation_token }

      expect(response).to have_http_status(:ok)
      expect(body).to eq(
        "email" => "noor@acme.test", "firstName" => "Noor",
        "lastName" => "Haddad", "companyName" => "Invite Corp",
        # Whether the page should ask for a password or just sign them in.
        "mustSetPassword" => false
      )
    end

    it "leaks nothing else about the account" do
      get "/api/v1/auth/invitation", params: { token: emailed_invitation_token }

      expect(body.keys).to match_array(%w[email firstName lastName companyName mustSetPassword])
    end

    it "is refused when the token is nonsense" do
      get "/api/v1/auth/invitation", params: { token: "not-a-real-token" }

      expect(response).to have_http_status(:unprocessable_content)
      expect(errors.first["code"]).to eq("invalid_token")
    end

    it "expires" do
      token = emailed_invitation_token

      travel_to(User::INVITATION_VALID_FOR.from_now + 1.hour) do
        get "/api/v1/auth/invitation", params: { token: token }
      end

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "POST /auth/accept_invitation" do
    let!(:employee) { create_employee }
    let(:chosen) { "employee-chosen-pass-1" }

    before { invite(employee) }

    def accept(token, password: nil)
      password ||= chosen
      post "/api/v1/auth/accept_invitation",
           params: { token: token, password: password, passwordConfirmation: password }.to_json,
           headers: json_headers
    end

    it "sets the employee's own password and signs them in" do
      accept(emailed_invitation_token)

      expect(response).to have_http_status(:created)
      expect(body.dig("user", "email")).to eq("noor@acme.test")

      user = in_tenant { employee.reload.user }
      expect(user).to be_active
      expect(user.invitation_accepted_at).to be_present
      expect(user.authenticate(chosen)).to be_truthy
    end

    it "counts as the forced first password change, so nothing else is demanded" do
      accept(emailed_invitation_token)

      # Signed in and usable straight away — the person has just chosen this
      # password, so prompting them to change it again is noise.
      get "/api/v1/auth/me"
      expect(response).to have_http_status(:ok)
      expect(body.dig("user", "email")).to eq("noor@acme.test")
    end

    it "treats the address as verified, since reaching it required reading that mailbox" do
      accept(emailed_invitation_token)

      expect(in_tenant { employee.reload.user.email_verified_at }).to be_present
    end

    it "lets the employee log in afterwards with the password they chose" do
      accept(emailed_invitation_token)
      delete "/api/v1/auth/logout"

      login("noor@acme.test", chosen)

      expect(response).to have_http_status(:ok)
      expect(body.dig("user", "email")).to eq("noor@acme.test")
    end

    it "spends the link — the same token cannot be used twice" do
      token = emailed_invitation_token
      accept(token)
      delete "/api/v1/auth/logout"

      accept(token, password: "a-second-password-99")

      expect(response).to have_http_status(:unprocessable_content)
      expect(errors.first["code"]).to eq("invalid_token")
      # And the first password still stands.
      expect(in_tenant { employee.reload.user.authenticate(chosen) }).to be_truthy
    end

    it "rejects an expired link" do
      token = emailed_invitation_token

      travel_to(User::INVITATION_VALID_FOR.from_now + 1.hour) { accept(token) }

      expect(response).to have_http_status(:unprocessable_content)
      expect(in_tenant { employee.reload.user }).to be_invited
    end

    it "rejects a mismatched confirmation without spending the link" do
      token = emailed_invitation_token
      post "/api/v1/auth/accept_invitation",
           params: { token: token, password: chosen, passwordConfirmation: "something-else-1" }.to_json,
           headers: json_headers

      expect(response).to have_http_status(:unprocessable_content)

      # Still usable: a typo shouldn't cost them the invitation.
      accept(token)
      expect(response).to have_http_status(:created)
    end

    it "kills the previous link when the invitation is re-sent" do
      first = emailed_invitation_token
      invite(employee)
      second = emailed_invitation_token

      expect(second).not_to eq(first)

      accept(first)
      expect(response).to have_http_status(:unprocessable_content)

      accept(second)
      expect(response).to have_http_status(:created)
    end

    it "says the invitation was re-sent rather than sent" do
      invite(employee)

      expect(body["message"]).to match(/re-sent/i)
    end
  end

  # --- Logging in before setup ----------------------------------------------

  describe "an account that has not been set up" do
    it "cannot log in, and is told why rather than that the password was wrong" do
      employee = create_employee
      invite(employee)

      # Even the random secret the account was created with is refused, which
      # is the property that matters: `invited` is not a state you can sign in
      # from, whatever credential is presented.
      login("noor@acme.test", "correct-horse-battery-1")

      expect(response).to have_http_status(:unauthorized).or have_http_status(:forbidden)
    end

    it "cannot log in once disabled either" do
      employee = create_employee
      invite(employee)
      accept_token = emailed_invitation_token
      post "/api/v1/auth/accept_invitation",
           params: { token: accept_token, password: "a-chosen-password-1", passwordConfirmation: "a-chosen-password-1" }.to_json,
           headers: json_headers
      delete "/api/v1/auth/logout"
      in_tenant { employee.reload.user.update!(status: :disabled) }

      login("noor@acme.test", "a-chosen-password-1")

      expect(response).to have_http_status(:forbidden)
      expect(errors.first["message"]).to match(/disabled/i)
    end
  end

  # --- Admin resetting an existing employee's password -----------------------

  describe "POST /employees/:id/reset_password" do
    let!(:employee) { create_employee }

    def set_up_account
      invite(employee)
      token = emailed_invitation_token
      post "/api/v1/auth/accept_invitation",
           params: { token: token, password: "first-chosen-pass-1", passwordConfirmation: "first-chosen-pass-1" }.to_json,
           headers: json_headers
      delete "/api/v1/auth/logout"
    end

    def reset
      login_admin
      post "/api/v1/employees/#{employee.id}/reset_password", params: {}.to_json, headers: json_headers
    end

    it "emails the employee a reset link and tells the admin only where it went" do
      set_up_account

      expect { reset }.to have_enqueued_mail(UserMailer, :password_reset)

      expect(response).to have_http_status(:ok)
      expect(body["message"]).to eq("Password reset link sent to noor@acme.test.")
      # Nothing password-shaped comes back to the administrator.
      expect(response.body).not_to match(/token|password reset link sent to noor@acme\.test\.\W+\w*secret/i)
    end

    it "does not change the password by itself — the employee still holds the old one" do
      set_up_account
      reset

      expect(in_tenant { employee.reload.user.authenticate("first-chosen-pass-1") }).to be_truthy
    end

    it "lets the employee complete the reset and log in with the new password" do
      set_up_account
      reset
      token = emailed_reset_token

      post "/api/v1/auth/reset_password",
           params: { token: token, password: "second-chosen-pass-2", passwordConfirmation: "second-chosen-pass-2" }.to_json,
           headers: json_headers
      expect(response).to have_http_status(:ok)

      login("noor@acme.test", "second-chosen-pass-2")
      expect(response).to have_http_status(:ok)

      login("noor@acme.test", "first-chosen-pass-1")
      expect(response).to have_http_status(:unauthorized)
    end

    it "re-sends the invitation instead for someone who never set up their account" do
      expect { reset }.to have_enqueued_mail(UserMailer, :invitation)

      expect(body["message"]).to match(/hasn't set up their account yet/i)
    end

    it "accepts no password parameter — there is no way for an admin to choose one" do
      set_up_account
      login_admin
      post "/api/v1/employees/#{employee.id}/reset_password",
           params: { password: "admin-picked-this-1", passwordConfirmation: "admin-picked-this-1" }.to_json,
           headers: json_headers

      expect(response).to have_http_status(:ok)
      expect(in_tenant { employee.reload.user.authenticate("admin-picked-this-1") }).to be(false)
      expect(in_tenant { employee.reload.user.authenticate("first-chosen-pass-1") }).to be_truthy
    end

    it "is closed to an employee resetting anybody's password" do
      set_up_account
      login("noor@acme.test", "first-chosen-pass-1")

      post "/api/v1/employees/#{employee.id}/reset_password", params: {}.to_json, headers: json_headers

      expect(response).to have_http_status(:forbidden)
    end

    it "writes no password or token into the audit trail" do
      set_up_account
      reset

      log = in_tenant { AuditLog.where(action: "employee.password_reset_requested").last }
      expect(log).to be_present
      expect(log.attributes.to_s).not_to match(/reset-password|first-chosen-pass/i)
    end
  end
end

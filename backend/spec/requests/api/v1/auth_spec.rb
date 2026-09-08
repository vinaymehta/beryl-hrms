require "rails_helper"

RSpec.describe "Api::V1::Auth", type: :request do
  let(:valid_params) do
    {
      companyName: "Acme Corp",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@acme.test",
      password: "correct-horse-battery-1",
      passwordConfirmation: "correct-horse-battery-1"
    }
  end

  describe "POST /api/v1/auth/register" do
    it "creates a company, an admin user, and starts a session" do
      post "/api/v1/auth/register", params: valid_params.to_json, headers: { "Content-Type" => "application/json" }

      expect(response).to have_http_status(:created)
      body = response.parsed_body
      expect(body["data"]["user"]["email"]).to eq("jane@acme.test")
      expect(body["data"]["roles"].map { |r| r["slug"] }).to include("admin")
      expect(body["data"]["permissions"]).not_to be_empty
      expect(response.cookies["session_id"]).to be_present
    end

    it "rejects a duplicate email" do
      create(:company).tap { |c| ActsAsTenant.with_tenant(c) { create(:user, company: c, email_address: "jane@acme.test") } }

      post "/api/v1/auth/register", params: valid_params.to_json, headers: { "Content-Type" => "application/json" }

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "POST /api/v1/auth/login" do
    it "rejects wrong credentials without revealing whether the email exists" do
      post "/api/v1/auth/login",
        params: { email: "nobody@acme.test", password: "wrong" }.to_json,
        headers: { "Content-Type" => "application/json" }

      expect(response).to have_http_status(:unauthorized)
      expect(response.parsed_body["errors"].first["code"]).to eq("invalid_credentials")
    end

    it "logs in with correct credentials" do
      post "/api/v1/auth/register", params: valid_params.to_json, headers: { "Content-Type" => "application/json" }
      cookies.delete("session_id")

      post "/api/v1/auth/login",
        params: { email: "jane@acme.test", password: "correct-horse-battery-1" }.to_json,
        headers: { "Content-Type" => "application/json" }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["data"]["user"]["email"]).to eq("jane@acme.test")
    end
  end

  describe "authenticated flow" do
    it "GET /me requires authentication, then logout actually revokes the session" do
      get "/api/v1/auth/me"
      expect(response).to have_http_status(:unauthorized)

      post "/api/v1/auth/register", params: valid_params.to_json, headers: { "Content-Type" => "application/json" }
      expect(response).to have_http_status(:created)

      get "/api/v1/auth/me"
      expect(response).to have_http_status(:ok)

      delete "/api/v1/auth/logout"
      expect(response).to have_http_status(:no_content)

      get "/api/v1/auth/me"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "POST /api/v1/auth/forgot_password" do
    it "responds identically whether or not the email exists (no account enumeration)" do
      post "/api/v1/auth/forgot_password", params: { email: "nobody@nowhere.test" }.to_json,
        headers: { "Content-Type" => "application/json" }
      no_account_status = response.status
      no_account_body = response.parsed_body

      post "/api/v1/auth/register", params: valid_params.to_json, headers: { "Content-Type" => "application/json" }
      post "/api/v1/auth/forgot_password", params: { email: "jane@acme.test" }.to_json,
        headers: { "Content-Type" => "application/json" }

      expect(response.status).to eq(no_account_status)
      expect(response.parsed_body).to eq(no_account_body)
    end
  end

  describe "PATCH /api/v1/auth/change_password" do
    it "requires the correct current password" do
      post "/api/v1/auth/register", params: valid_params.to_json, headers: { "Content-Type" => "application/json" }

      patch "/api/v1/auth/change_password",
        params: { currentPassword: "wrong", newPassword: "new-correct-horse-1", newPasswordConfirmation: "new-correct-horse-1" }.to_json,
        headers: { "Content-Type" => "application/json" }

      expect(response).to have_http_status(:unprocessable_content)
    end

    it "changes the password and revokes other sessions" do
      post "/api/v1/auth/register", params: valid_params.to_json, headers: { "Content-Type" => "application/json" }

      patch "/api/v1/auth/change_password",
        params: { currentPassword: "correct-horse-battery-1", newPassword: "new-correct-horse-1", newPasswordConfirmation: "new-correct-horse-1" }.to_json,
        headers: { "Content-Type" => "application/json" }

      expect(response).to have_http_status(:ok)
    end
  end
end

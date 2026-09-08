require "swagger_helper"

# Real rswag-DSL specs (not plain request specs) so `rake rswag:specs:swaggerize`
# generates actual OpenAPI output for these endpoints at /api-docs — the
# plain specs in spec/requests/api/v1/auth_spec.rb cover edge cases more
# thoroughly; this file's job is documentation generation, not exhaustive coverage.
RSpec.describe "Auth", type: :request do
  let(:password) { "correct-horse-battery-1" }

  def register!(email: "jane@acme.test")
    post "/api/v1/auth/register",
      params: {
        companyName: "Acme Corp", firstName: "Jane", lastName: "Doe",
        email: email, password: password, passwordConfirmation: password
      }.to_json,
      headers: { "Content-Type" => "application/json" }
  end

  path "/api/v1/auth/register" do
    post "Register a new company and its first (Admin) user" do
      tags "Auth"
      consumes "application/json"
      produces "application/json"
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          companyName: { type: :string }, firstName: { type: :string }, lastName: { type: :string },
          email: { type: :string }, password: { type: :string }, passwordConfirmation: { type: :string }
        },
        required: %w[companyName firstName lastName email password passwordConfirmation]
      }

      response "201", "company and admin user created; session cookie set" do
        let(:body) do
          { companyName: "Acme Corp", firstName: "Jane", lastName: "Doe",
            email: "jane@acme.test", password: password, passwordConfirmation: password }
        end
        run_test!
      end

      response "422", "validation failed (e.g. duplicate email)" do
        before { register! }
        let(:body) do
          { companyName: "Acme Corp", firstName: "Jane", lastName: "Doe",
            email: "jane@acme.test", password: password, passwordConfirmation: password }
        end
        run_test!
      end
    end
  end

  path "/api/v1/auth/login" do
    post "Log in with email and password" do
      tags "Auth"
      consumes "application/json"
      produces "application/json"
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: { email: { type: :string }, password: { type: :string } },
        required: %w[email password]
      }

      response "200", "session cookie set, returns user/company/roles/permissions" do
        before { register! }
        let(:body) { { email: "jane@acme.test", password: password } }
        run_test!
      end

      response "401", "invalid credentials" do
        let(:body) { { email: "nobody@acme.test", password: "wrong" } }
        run_test!
      end
    end
  end

  path "/api/v1/auth/me" do
    get "Return the authenticated user, company, roles, and permissions" do
      tags "Auth"
      produces "application/json"

      response "200", "authenticated" do
        before { register! }
        run_test!
      end

      response "401", "no valid session" do
        run_test!
      end
    end
  end

  path "/api/v1/auth/logout" do
    delete "Revoke the current session" do
      tags "Auth"

      response "204", "session revoked" do
        before { register! }
        run_test!
      end
    end
  end

  path "/api/v1/auth/forgot_password" do
    post "Request a password reset email" do
      tags "Auth"
      consumes "application/json"
      produces "application/json"
      parameter name: :body, in: :body, schema: {
        type: :object, properties: { email: { type: :string } }, required: %w[email]
      }

      response "200", "always 200, regardless of whether the email exists (no account enumeration)" do
        let(:body) { { email: "jane@acme.test" } }
        run_test!
      end
    end
  end

  path "/api/v1/auth/reset_password" do
    post "Reset the password using a token from the forgot_password email" do
      tags "Auth"
      consumes "application/json"
      produces "application/json"
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: { token: { type: :string }, password: { type: :string }, passwordConfirmation: { type: :string } },
        required: %w[token password passwordConfirmation]
      }

      response "422", "invalid or expired token" do
        let(:body) { { token: "not-a-real-token", password: password, passwordConfirmation: password } }
        run_test!
      end
    end
  end

  path "/api/v1/auth/change_password" do
    patch "Change password while authenticated (requires current password)" do
      tags "Auth"
      consumes "application/json"
      produces "application/json"
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          currentPassword: { type: :string }, newPassword: { type: :string }, newPasswordConfirmation: { type: :string }
        },
        required: %w[currentPassword newPassword newPasswordConfirmation]
      }

      response "200", "password changed; other sessions revoked" do
        before { register! }
        let(:body) { { currentPassword: password, newPassword: "new-correct-horse-1", newPasswordConfirmation: "new-correct-horse-1" } }
        run_test!
      end

      response "422", "current password incorrect" do
        before { register! }
        let(:body) { { currentPassword: "wrong", newPassword: "new-correct-horse-1", newPasswordConfirmation: "new-correct-horse-1" } }
        run_test!
      end
    end
  end

  path "/api/v1/auth/sessions" do
    get "List the authenticated user's active sessions" do
      tags "Auth"
      produces "application/json"

      response "200", "list of sessions, current one flagged" do
        before { register! }
        run_test!
      end
    end
  end
end

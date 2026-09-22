require "rails_helper"

# config/environments/test.rb sets allow_forgery_protection = false so the rest
# of the suite can POST freely. These examples turn it back on, because the bug
# they guard against was precisely that the flag was never true ANYWHERE.
#
# This is an ActionController::API app, and Rails only defaults
# allow_forgery_protection to true for ActionController::Base. In API mode it
# stays nil, so CsrfProtection's `return unless ...allow_forgery_protection`
# short-circuited on every request in every environment — the double-submit
# token and the origin check were both dead code, in production included.
RSpec.describe "CSRF protection", type: :request do
  around do |example|
    original = Rails.application.config.action_controller.allow_forgery_protection
    Rails.application.config.action_controller.allow_forgery_protection = true
    example.run
    Rails.application.config.action_controller.allow_forgery_protection = original
  end

  let(:json_headers) { { "Content-Type" => "application/json" } }
  let(:origin) { FrontendOrigins.primary }

  def csrf_cookie
    cookies[:csrf_token]
  end

  # A browser has always made at least one request before it submits anything,
  # which is what mints the cookie. Mirrors what the API client now does.
  def establish_token
    get "/api/v1/auth/me"
    csrf_cookie
  end

  def register(token:, request_origin: nil)
    headers = json_headers.dup
    headers["X-CSRF-Token"] = token if token
    headers["Origin"] = request_origin if request_origin

    post "/api/v1/auth/register",
         params: {
           companyName: "Csrf Corp", firstName: "Ada", lastName: "Admin",
           email: "csrf.admin@acme.test", password: "correct-horse-battery-1",
           passwordConfirmation: "correct-horse-battery-1"
         }.to_json,
         headers: headers
  end

  it "is actually ON — the flag is not silently disabled in API mode" do
    # The regression itself: a truthy check on a nil flag skipped everything.
    expect(Rails.application.config.action_controller.allow_forgery_protection).not_to be(false)

    register(token: nil)

    expect(response).to have_http_status(:unprocessable_content)
    expect(response.parsed_body["errors"].first["code"]).to eq("invalid_csrf_token")
  end

  it "mints a token cookie on a plain GET, even unauthenticated" do
    get "/api/v1/auth/me"

    expect(response).to have_http_status(:unauthorized)
    expect(csrf_cookie).to be_present
  end

  it "accepts a mutating request carrying the matching token" do
    token = establish_token

    register(token: token, request_origin: origin)

    expect(response).to have_http_status(:created)
  end

  it "rejects a token that doesn't match the cookie" do
    establish_token

    register(token: "not-the-cookie-value", request_origin: origin)

    expect(response).to have_http_status(:unprocessable_content)
  end

  it "rejects a correct token sent from a foreign origin" do
    token = establish_token

    # The shape of a real attack that has somehow obtained a token: the Origin
    # header is set by the browser and cannot be forged by page JavaScript.
    register(token: token, request_origin: "https://evil.example")

    expect(response).to have_http_status(:unprocessable_content)
  end

  it "leaves safe methods alone" do
    get "/api/v1/auth/me"

    expect(response).to have_http_status(:unauthorized) # not 422
  end

  describe "FrontendOrigins" do
    it "refuses to invent a localhost origin in production" do
      allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("production"))
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("FRONTEND_ORIGINS").and_return(nil)

      expect { FrontendOrigins.all }.to raise_error(
        FrontendOrigins::MissingConfiguration, /FRONTEND_ORIGINS is not set/
      )
    end

    it "keeps the development convenience" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("FRONTEND_ORIGINS").and_return(nil)

      expect(FrontendOrigins.all).to eq([ FrontendOrigins::DEVELOPMENT_FALLBACK ])
    end

    it "splits and trims a multi-origin value" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("FRONTEND_ORIGINS").and_return(" https://a.test , https://b.test ")

      expect(FrontendOrigins.all).to eq([ "https://a.test", "https://b.test" ])
      expect(FrontendOrigins.primary).to eq("https://a.test")
    end
  end
end

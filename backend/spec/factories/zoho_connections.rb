FactoryBot.define do
  factory :zoho_connection do
    company
    connection_type { :company_managed }
    status { :active }
    sequence(:email_address) { |n| "mailbox#{n}@acme.test" }
    access_token { "test-access-token" }
    refresh_token { "test-refresh-token" }
    token_expires_at { 1.hour.from_now }
  end
end

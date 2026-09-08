FactoryBot.define do
  factory :user do
    company
    sequence(:email_address) { |n| "user#{n}@example.com" }
    password { "correct-horse-battery-1" }
    first_name { "Test" }
    last_name { "User" }
    status { :active }
  end
end

FactoryBot.define do
  factory :role do
    company
    sequence(:name) { |n| "Role #{n}" }
  end
end

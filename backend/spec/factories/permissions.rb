FactoryBot.define do
  factory :permission do
    sequence(:key) { |n| "resource#{n}.view" }
    resource { key.to_s.split(".").first }
    action { key.to_s.split(".").last }
  end
end

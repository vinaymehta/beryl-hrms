FactoryBot.define do
  factory :employee do
    company
    sequence(:employee_code) { |n| "EMP#{n}" }
    first_name { "Test" }
    last_name { "Employee" }
  end
end

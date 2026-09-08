FactoryBot.define do
  factory :user_role do
    user
    role
    company { user.company }
  end
end

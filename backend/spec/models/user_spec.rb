require "rails_helper"

RSpec.describe User, type: :model do
  it "normalizes email address to lowercase, trimmed" do
    user = ActsAsTenant.with_tenant(create(:company)) { create(:user, email_address: "  Mixed@Case.Test  ") }
    expect(user.email_address).to eq("mixed@case.test")
  end

  it "requires first_name and last_name" do
    user = ActsAsTenant.with_tenant(create(:company)) { build(:user, first_name: nil) }
    expect(user).not_to be_valid
    expect(user.errors[:first_name]).to be_present
  end

  it "hashes the password (never stores it in plain text)" do
    user = ActsAsTenant.with_tenant(create(:company)) { create(:user, password: "correct-horse-battery-1") }
    expect(user.password_digest).not_to eq("correct-horse-battery-1")
    expect(user.authenticate("correct-horse-battery-1")).to eq(user)
    expect(user.authenticate("wrong")).to be false
  end
end

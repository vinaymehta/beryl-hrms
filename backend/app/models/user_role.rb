class UserRole < ApplicationRecord
  acts_as_tenant(:company)

  belongs_to :company
  belongs_to :user
  belongs_to :role

  before_validation :set_company_from_user

  validates :role_id, uniqueness: { scope: :user_id }
  # The decisive integrity check: a raw role_id from params must never let a
  # Company-A user be assigned a Company-B role. acts_as_tenant's default
  # scope only helps when lookups go through current_company.roles — this
  # validation is the guard for the case where it doesn't.
  validate :user_and_role_same_company

  private
    def set_company_from_user
      self.company_id ||= user&.company_id
    end

    def user_and_role_same_company
      return if user.nil? || role.nil?

      if user.company_id != role.company_id
        errors.add(:role, "must belong to the same company as the user")
      end
    end
end

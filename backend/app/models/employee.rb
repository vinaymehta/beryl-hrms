class Employee < ApplicationRecord
  acts_as_tenant(:company)

  # Bank details/tax IDs/government IDs deliberately not here — Phase 6
  # (Accounts/Payroll) concern, not HR profile data.
  enum :status, { active: 0, inactive: 1, offboarded: 2 }, default: :active

  belongs_to :company
  belongs_to :user, optional: true, inverse_of: :employee_record
  belongs_to :department, optional: true
  belongs_to :designation, optional: true
  has_many :leave_requests, dependent: :destroy
  has_many :attendance_records, dependent: :destroy
  has_many :documents, dependent: :destroy
  has_one_attached :profile_photo

  validates :employee_code, presence: true, uniqueness: { scope: :company_id }
  validates :first_name, :last_name, presence: true

  def full_name
    "#{first_name} #{last_name}".strip
  end
end

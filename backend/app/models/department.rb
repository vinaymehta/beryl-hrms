class Department < ApplicationRecord
  acts_as_tenant(:company)

  enum :status, { active: 0, archived: 1 }, default: :active

  belongs_to :company
  has_many :designations, dependent: :nullify
  has_many :employees, dependent: :nullify

  validates :name, presence: true, uniqueness: { scope: :company_id }
end

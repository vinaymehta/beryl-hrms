class Designation < ApplicationRecord
  acts_as_tenant(:company)

  enum :status, { active: 0, archived: 1 }, default: :active

  belongs_to :company
  belongs_to :department, optional: true
  has_many :employees, dependent: :nullify

  validates :title, presence: true
end

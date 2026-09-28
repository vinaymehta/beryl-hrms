class EmploymentType < ApplicationRecord
  acts_as_tenant(:company)

  # Seeded for every new company, in this order. Also the values the old
  # employees.employment_type enum held — see CreateEmploymentTypes.
  DEFAULTS = [ "Full-time", "Part-time", "Contract", "Intern", "Consultant" ].freeze

  enum :status, { active: 0, archived: 1 }, default: :active

  belongs_to :company
  has_many :employees, dependent: :nullify

  validates :name, presence: true, uniqueness: { scope: :company_id }

  def self.seed_defaults(company)
    DEFAULTS.each { |name| company.employment_types.find_or_create_by!(name: name) }
  end
end

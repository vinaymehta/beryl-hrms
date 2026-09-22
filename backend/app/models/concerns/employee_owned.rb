# Everything hanging off an employee profile shares the same four lines: tenant
# scoping, the two belongs_to, and deriving company_id from the employee so a
# caller can never set a mismatched one. Extracted rather than repeated eight
# times.
module EmployeeOwned
  extend ActiveSupport::Concern

  included do
    acts_as_tenant(:company)

    belongs_to :company
    belongs_to :employee

    before_validation :set_company_from_employee

    scope :newest_first, -> { order(created_at: :desc) }
  end

  private
    def set_company_from_employee
      self.company_id ||= employee&.company_id
    end
end

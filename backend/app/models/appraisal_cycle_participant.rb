# The eligible-employee set, editable while the cycle is a draft. Kept separate
# from `appraisals` so eligibility can be revised before anything is
# instantiated — once the cycle starts, this list is what Appraisals::StartCycle
# reads to create one appraisal each.
class AppraisalCycleParticipant < ApplicationRecord
  acts_as_tenant(:company)

  belongs_to :company
  belongs_to :appraisal_cycle, inverse_of: :participants
  belongs_to :employee

  before_validation :set_company_from_cycle

  validates :employee_id, uniqueness: { scope: :appraisal_cycle_id }
  validate :employee_same_company

  private
    def set_company_from_cycle
      self.company_id ||= appraisal_cycle&.company_id
    end

    def employee_same_company
      return if appraisal_cycle.nil? || employee.nil?

      errors.add(:employee, "must belong to the same company") if appraisal_cycle.company_id != employee.company_id
    end
end

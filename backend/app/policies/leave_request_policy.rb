class LeaveRequestPolicy < ApplicationPolicy
  def index? = permission?("leave.view")
  def show? = permission?("leave.view")
  def create? = permission?("leave.create")
  # Approve/reject are both gated on the same permission — the action taken
  # (approved vs rejected) is a param on the same update, not a separate grant.
  def update? = permission?("leave.approve")

  class Scope < ApplicationPolicy::Scope
    def resolve
      base = scope.where(company_id: user.company_id)
      return base if user.permission?("leave.approve")

      base.where(employee_id: user.employee_record&.id)
    end
  end
end

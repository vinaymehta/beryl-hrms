class AppraisalCyclePolicy < ApplicationPolicy
  def index? = permission?("appraisal_cycles.view")
  def show? = index?
  def create? = permission?("appraisal_cycles.manage")
  def update? = create?
  def destroy? = create?
  def start? = create?
  def close? = create?

  class Scope < ApplicationPolicy::Scope
    def resolve
      scope.where(company_id: user.company_id)
    end
  end
end

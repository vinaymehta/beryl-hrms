class AppraisalTemplatePolicy < ApplicationPolicy
  def index? = permission?("appraisal_templates.view")
  def show? = index?
  def create? = permission?("appraisal_templates.manage")
  def update? = create?
  def destroy? = create?
  def new_version? = create?
  def activate? = create?

  class Scope < ApplicationPolicy::Scope
    def resolve
      scope.where(company_id: user.company_id)
    end
  end
end

class DesignationPolicy < ApplicationPolicy
  def index? = permission?("designations.view")
  def show? = permission?("designations.view")
  def create? = permission?("designations.create")
  def update? = permission?("designations.update")
  def destroy? = permission?("designations.delete")

  class Scope < ApplicationPolicy::Scope
    def resolve
      scope.where(company_id: user.company_id)
    end
  end
end

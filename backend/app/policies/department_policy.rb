class DepartmentPolicy < ApplicationPolicy
  def index? = permission?("departments.view")
  def show? = permission?("departments.view")
  def create? = permission?("departments.create")
  def update? = permission?("departments.update")
  def destroy? = permission?("departments.delete")

  class Scope < ApplicationPolicy::Scope
    def resolve
      scope.where(company_id: user.company_id)
    end
  end
end

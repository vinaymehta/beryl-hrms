class EmploymentTypePolicy < ApplicationPolicy
  def index? = permission?("employment_types.view")
  def show? = permission?("employment_types.view")
  def create? = permission?("employment_types.create")
  def update? = permission?("employment_types.update")
  def destroy? = permission?("employment_types.delete")

  class Scope < ApplicationPolicy::Scope
    def resolve
      scope.where(company_id: user.company_id)
    end
  end
end

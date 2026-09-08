class EmployeePolicy < ApplicationPolicy
  def index? = permission?("employees.view")
  def show? = permission?("employees.view")
  def create? = permission?("employees.create")
  def update? = permission?("employees.update")
  # Deactivation (status -> inactive/offboarded) is gated on the delete
  # permission per the spec's "prefer deactivation over destroy" guidance —
  # there is no literal DELETE route for employees.
  def deactivate? = permission?("employees.delete")

  class Scope < ApplicationPolicy::Scope
    def resolve
      scope.where(company_id: user.company_id)
    end
  end
end

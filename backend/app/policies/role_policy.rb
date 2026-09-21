# Read-only for now: the Employee form needs the company's real Role list to
# offer (rather than a hard-coded Admin/HR/Employee triple), so whoever may
# assign roles may also read them. Full role/permission editing lives behind
# roles.manage and arrives with the Settings screen.
class RolePolicy < ApplicationPolicy
  def index? = permission?("roles.manage") || permission?("employees.manage_roles")
  def show? = index?

  class Scope < ApplicationPolicy::Scope
    def resolve
      scope.where(company_id: user.company_id)
    end
  end
end

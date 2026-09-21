class EmployeePolicy < ApplicationPolicy
  def index? = permission?("employees.view")
  def show? = permission?("employees.view")
  def create? = permission?("employees.create")
  def update? = permission?("employees.update")
  # Deactivation (status -> inactive/offboarded) is gated on the delete
  # permission per the spec's "prefer deactivation over destroy" guidance —
  # there is no literal DELETE route for employees.
  def deactivate? = permission?("employees.delete")

  # Two rights held today by exactly the Admin and HR default roles, but
  # expressed as permission keys rather than a slug check, so moving either
  # one to another role is a Settings change and not a code change.
  #
  #   employees.manage_roles               — give this employee a login and
  #                                          decide which Roles it carries.
  #   employees.manage_reporting_managers  — assign this employee's Primary /
  #                                          Secondary / Final manager.
  #
  # Nobody edits their OWN hierarchy by holding these: the keys aren't in the
  # Employee role's seeded set at all, so an employee viewing their profile can
  # read their managers and change nothing about them. Being somebody's manager
  # grants neither key either — a manager assignment is not a system role.
  def manage_roles? = permission?("employees.manage_roles")
  def manage_reporting_managers? = permission?("employees.manage_reporting_managers")

  class Scope < ApplicationPolicy::Scope
    # employees.create is the seeded proxy for "HR/Admin, looks after other
    # people" — the same shape DocumentPolicy::Scope uses for documents. Only
    # the HR and Admin default roles carry it.
    #
    # Everyone else sees exactly one employee: themselves. employees.view on
    # its own was enough to browse the whole company directory, which is more
    # than someone who is only meant to look after their own record needs.
    # Narrowing here rather than in the controller means every path — list,
    # detail, any future one — is scoped the same way by construction.
    MANAGES_PEOPLE = %w[employees.create employees.update employees.delete].freeze

    def resolve
      base = scope.where(company_id: user.company_id)
      return base if MANAGES_PEOPLE.any? { |key| user.permission?(key) }

      # find_by on an id that isn't theirs then 404s rather than 403s, which
      # tells them nothing about who else exists.
      base.where(id: user.employee_record&.id)
    end
  end
end

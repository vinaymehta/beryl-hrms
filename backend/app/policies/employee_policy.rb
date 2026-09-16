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

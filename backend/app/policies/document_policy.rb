class DocumentPolicy < ApplicationPolicy
  def index? = permission?("documents.view")
  def show? = permission?("documents.view")
  def create? = permission?("documents.create")
  def destroy? = permission?("documents.delete")
  # Reading the file itself carries the same requirement as seeing the
  # record — no separate "download" permission in the catalog.
  def download? = permission?("documents.view")

  class Scope < ApplicationPolicy::Scope
    # documents.create is the seeded proxy for "HR/Admin, sees every
    # employee's documents" — the catalog has no separate
    # "documents.manage_all" key; only HR/Admin roles carry .create today.
    def resolve
      base = scope.where(company_id: user.company_id)
      return base if user.permission?("documents.create")

      base.where(employee_id: user.employee_record&.id)
    end
  end
end

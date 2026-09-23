# Read-only by design. An audit log that anyone could write to, edit or delete
# is not an audit log, so there are no create/update/destroy questions to ask
# here — Audit::Record is the only writer, and nothing deletes.
class AuditLogPolicy < ApplicationPolicy
  def index? = permission?("audit_logs.view")

  def show? = index?

  class Scope < ApplicationPolicy::Scope
    # AuditLog is deliberately NOT acts_as_tenant (company_id is nullable for
    # platform-level events), so the tenant filter that other models get for
    # free has to be applied by hand here. Platform rows have no company and
    # belong to nobody's company view, so they are excluded rather than shown
    # to whoever happens to ask first.
    def resolve
      return scope.none if user.nil?
      return scope.none unless user.permission?("audit_logs.view")

      scope.where(company_id: user.company_id)
    end
  end
end

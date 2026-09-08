class ZohoConnectionPolicy < ApplicationPolicy
  def index? = permission?("mail.view")
  def search? = permission?("mail.search")

  def create_company? = permission?("zoho_connections.manage")

  # Any user with mail.view can connect their own individual mailbox.
  def create_individual? = permission?("mail.view")

  def destroy?
    return false unless same_company?

    if record.company_managed?
      permission?("zoho_connections.manage")
    else
      record.user_id == user.id || permission?("zoho_connections.manage")
    end
  end

  class Scope < ApplicationPolicy::Scope
    def resolve
      scope.where(company_id: user.company_id).where("user_id = ? OR user_id IS NULL", user.id)
    end
  end
end

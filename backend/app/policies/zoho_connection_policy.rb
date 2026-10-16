class ZohoConnectionPolicy < ApplicationPolicy
  def index? = permission?("mail.view")
  def search? = permission?("mail.search")

  def create_company? = permission?("zoho_connections.manage")

  # Choosing which company mailbox sends recruitment email.
  def make_recruitment_sender? = same_company? && record.company_managed? && permission?("zoho_connections.manage")

  # Any user with mail.view can connect their own individual mailbox.
  def create_individual? = permission?("mail.view")

  # Re-running OAuth for an existing connection. Unlike destroy?, someone
  # else's personal mailbox is never reconnectable: the reconnect signs in to
  # Zoho as whoever is at the keyboard, so only its owner can do it.
  def reconnect?
    return false unless same_company?

    record.company_managed? ? permission?("zoho_connections.manage") : record.user_id == user.id
  end

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

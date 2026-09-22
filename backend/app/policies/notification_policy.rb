class NotificationPolicy < ApplicationPolicy
  def index? = permission?("notifications.view")
  def update? = index? && record.user_id == user.id

  class Scope < ApplicationPolicy::Scope
    # A notification is addressed to one person; nobody reads anyone else's.
    def resolve
      scope.where(company_id: user.company_id, user_id: user.id)
    end
  end
end

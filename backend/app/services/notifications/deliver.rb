module Notifications
  # The one place an in-app notification is created. Nothing here sends email:
  # the scope asks for in-app only, and the existing mailers are wired to
  # specific flows (verification, password, recruitment) that this must not
  # piggyback on.
  #
  # Silently no-ops for an employee with no login rather than raising — plenty
  # of employees have no User (see db/seeds.rb), and that must never be the
  # reason a workflow transition fails.
  class Deliver
    def self.call(...) = new(...).call

    def self.to_employee(employee, **kwargs)
      return nil if employee&.user.nil?

      call(user: employee.user, **kwargs)
    end

    def initialize(user:, category:, title:, body: nil, action_url: nil, notifiable: nil)
      @user = user
      @category = category
      @title = title
      @body = body
      @action_url = action_url
      @notifiable = notifiable
    end

    def call
      return nil if @user.nil?

      Notification.create!(
        company_id: @user.company_id,
        user: @user,
        category: @category,
        title: @title,
        body: @body,
        action_url: @action_url,
        notifiable: @notifiable
      )
    end
  end
end

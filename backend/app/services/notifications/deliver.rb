module Notifications
  # The one place a notification is raised — in-app AND by email.
  #
  # Both, from one call, on purpose. The alternative is a mailer call sitting
  # beside each `Deliver` call, and the failure mode of that is silent: someone
  # adds a workflow event, creates the in-app notification, forgets the email,
  # and nobody notices until a reviewer says they were never told. Putting the
  # email here means a new event cannot ship as in-app only, because there is
  # no code path that produces one without the other.
  #
  # Silently no-ops for an employee with no login rather than raising — plenty
  # of employees have no User (see db/seeds.rb), and that must never be the
  # reason a workflow transition fails.
  class Deliver
    def self.call(...) = new(...).call

    # Skipping is correct — but skipping SILENTLY is not. An appraisal whose
    # reviewer has no login parks at that stage forever and nothing anywhere
    # says why, so the drop is logged even though it isn't an error.
    def self.to_employee(employee, **kwargs)
      if employee&.user.nil?
        Rails.logger.info(
          "[notifications] skipped #{kwargs[:category]} — " \
          "#{employee ? "employee ##{employee.id} (#{employee.full_name}) has no login" : 'no employee given'}"
        )
        return nil
      end

      call(user: employee.user, **kwargs)
    end

    # @param email_context [Array<Array(String, String)>] labelled lines for the
    #   email body, in the order they should read.
    # @param email [Boolean] false for a notification that genuinely should not
    #   be mailed. Defaults to true so silence is never the accident.
    def initialize(user:, category:, title:, body: nil, action_url: nil, notifiable: nil,
                   email_context: [], email: true)
      @user = user
      @category = category
      @title = title
      @body = body
      @action_url = action_url
      @notifiable = notifiable
      @email_context = email_context
      @email = email
    end

    def call
      return nil if @user.nil?

      notification = Notification.create!(
        company_id: @user.company_id,
        user: @user,
        category: @category,
        title: @title,
        body: @body,
        action_url: @action_url,
        notifiable: @notifiable,
        email_context: Array(@email_context).map { |pair| Array(pair).map(&:to_s) }
      )

      send_email(notification) if @email
      notification
    end

    private
      # Email is a courtesy, and courtesies do not get to fail a workflow.
      #
      # `deliver_later` only enqueues, but enqueuing itself can raise — Redis
      # being down is the ordinary case — and this runs inside the transaction
      # that submits an appraisal. A raise here would roll that submission
      # back, which is precisely the wrong trade: the person did the work, and
      # losing it because a mail queue was unavailable is worse than them not
      # getting an email. So it is caught and logged, and the in-app
      # notification stands on its own.
      def send_email(notification)
        return if @user.email_address.blank?

        NotificationMailer.notify(notification).deliver_later
      rescue StandardError => e
        Rails.logger.error(
          "[notifications] #{@category} for user ##{@user.id} was created in-app but its email " \
          "could not be queued: #{e.class}: #{e.message}"
        )
      end
  end
end

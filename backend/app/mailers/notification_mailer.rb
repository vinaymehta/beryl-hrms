class NotificationMailer < ApplicationMailer
  # The email counterpart of an in-app notification.
  #
  # One mailer for every notification the app raises, rather than a method per
  # event. The reason is the rule it enforces: Notifications::Deliver sends
  # this for EVERY notification it creates, so a new event cannot accidentally
  # ship as in-app only. A mailer method per event would put that back —
  # somebody adds an event, forgets the method, and the email silently never
  # exists.
  #
  # The notification already carries everything a recipient needs: what
  # happened, about whom, and where to go. This renders that, with the context
  # lines the workflow supplies, and nothing else — deliberately no scores, no
  # ratings, no review commentary, because mail is the one channel we do not
  # control the audience of.
  def notify(notification)
    @notification = notification
    @user = notification.user
    @context = Array(notification.email_context)
    @url = action_url(notification)

    log_link_for_dev("Notification", @url) if @url
    mail(to: @user.email_address, subject: notification.title)
  end

  private
    # Notifications store an app-relative path; email needs somewhere a browser
    # can actually go.
    def action_url(notification)
      path = notification.action_url.presence
      return nil if path.nil?
      return path if path.start_with?("http")

      "#{FrontendOrigins.primary.chomp('/')}#{path.start_with?('/') ? path : "/#{path}"}"
    end

    def log_link_for_dev(label, url)
      return unless Rails.env.development?

      puts "\n\e[35m[#{label} link] #{url}\e[0m\n"
    end
end

module Api
  module V1
    class NotificationsController < Api::V1::BaseController
      def index
        authorize Notification
        notifications = policy_scope(Notification).newest_first.limit(50)
        render json: {
          data: Api::V1::NotificationSerializer.new(notifications).as_json,
          meta: { unreadCount: policy_scope(Notification).unread.count }
        }
      end

      def update
        notification = policy_scope(Notification).find(params[:id])
        authorize notification
        notification.mark_read!
        render_data(Api::V1::NotificationSerializer.new(notification).as_json)
      end

      def mark_all_read
        authorize Notification, :index?
        policy_scope(Notification).unread.update_all(read_at: Time.current, updated_at: Time.current)
        head :no_content
      end
    end
  end
end

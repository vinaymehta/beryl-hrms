# Live notifications: one stream per signed-in user.
#
# The payload is only a nudge — "your notifications changed" plus the unread
# count — and the client re-reads GET /notifications for the rows. That keeps
# one source of truth for what a notification looks like (the serializer and
# its policy scope) instead of a second copy of it living in the broadcast.
class NotificationsChannel < ApplicationCable::Channel
  def subscribed
    stream_for current_user
  end

  # Called from Notification's commit callbacks and from mark_all_read.
  def self.notify(user)
    unread = ActsAsTenant.without_tenant { Notification.where(user_id: user.id).unread.count }
    broadcast_to(user, { event: "changed", unreadCount: unread })
  rescue StandardError, LoadError => e
    # A notification is written whether or not anyone is listening, and a
    # cable/Redis hiccup must never fail the workflow that raised it.
    # LoadError too: a pub/sub adapter that can't load raises Gem::LoadError,
    # which is not a StandardError — it once took down starting a cycle.
    Rails.logger.warn("[notifications] live update not sent to user ##{user.id}: #{e.class}: #{e.message}")
  end
end

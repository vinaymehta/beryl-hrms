module Api
  module V1
    class NotificationSerializer < ApplicationSerializer
      attributes :id, :category, :title, :body, :action_url, :read_at, :created_at
    end
  end
end

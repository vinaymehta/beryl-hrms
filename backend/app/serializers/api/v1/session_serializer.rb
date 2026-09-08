module Api
  module V1
    class SessionSerializer < ApplicationSerializer
      attributes :id, :ip_address, :user_agent, :created_at, :expires_at

      attribute :current do |session|
        session.id == Current.session&.id
      end
    end
  end
end

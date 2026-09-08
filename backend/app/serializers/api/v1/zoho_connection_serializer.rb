module Api
  module V1
    class ZohoConnectionSerializer < ApplicationSerializer
      # Never expose access_token/refresh_token — this is the entire public
      # shape of a connection, by omission rather than an explicit denylist.
      attributes :id, :connection_type, :email_address, :status, :last_synced_at, :user_id
    end
  end
end

module Api
  module V1
    class ZohoConnectionSerializer < ApplicationSerializer
      # Never expose access_token/refresh_token — this is the entire public
      # shape of a connection, by omission rather than an explicit denylist.
      attributes :id, :connection_type, :email_address, :status, :last_synced_at, :user_id

      # The one recruitment email is actually sent from right now — picked on
      # the Mail page, or the oldest connected one (Company#effective_…).
      attribute :recruitment_sender do |connection|
        connection.company.effective_recruitment_mail_connection&.id == connection.id
      end
    end
  end
end

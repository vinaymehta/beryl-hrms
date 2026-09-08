# Refreshes any ZohoConnection whose access token is close to expiring.
# Runs through ActiveJob (mandated for every tenant-touching job in this
# app — see docs/ARCHITECTURE.md) even though this one deliberately spans
# *all* companies: it wraps each connection's work in its own
# ActsAsTenant.with_tenant rather than relying on the single tenant
# ActiveJob would otherwise auto-restore, since there is no one tenant for
# a platform-wide sweep.
class ZohoTokenRefreshJob < ApplicationJob
  queue_as :default

  REFRESH_WINDOW = 10.minutes

  def perform
    ActsAsTenant.without_tenant do
      ZohoConnection.active.where("token_expires_at <= ?", Time.current + REFRESH_WINDOW).find_each do |connection|
        refresh_one(connection)
      end
    end
  end

  private
    def refresh_one(connection)
      ActsAsTenant.with_tenant(connection.company) do
        tokens = Zoho::Client.new.refresh_access_token(refresh_token: connection.refresh_token)
        connection.update!(
          access_token: tokens[:access_token],
          token_expires_at: tokens[:expires_in].to_i.seconds.from_now
        )
      end
    rescue Zoho::ApiError => e
      ActsAsTenant.with_tenant(connection.company) { connection.update(status: :error) }
      Rails.logger.warn("[ZohoTokenRefreshJob] connection #{connection.id} failed to refresh: #{e.message}")
    end
end

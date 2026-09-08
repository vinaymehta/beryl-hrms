# Platform-wide maintenance, intentionally not tenant-scoped: `sessions` has
# no company_id column (it's not a tenant-owned table, see docs/ERD.md), so
# there's no ActsAsTenant.with_tenant to wrap here — every other job in this
# app that touches a tenant-owned model does wrap one.
class CleanupExpiredSessionsJob < ApplicationJob
  queue_as :default

  def perform
    Session.where("expires_at IS NOT NULL AND expires_at <= ?", Time.current).delete_all
  end
end

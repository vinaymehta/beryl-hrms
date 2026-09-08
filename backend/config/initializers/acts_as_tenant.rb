# Fail CLOSED, not open: if a request reaches a tenant-scoped query without
# ActsAsTenant.current_tenant having been set (missing/misordered before_action,
# a forgotten job wrapper, a console slip), raise instead of silently returning
# unscoped (all-companies) data. This is the single highest-leverage line in
# the whole multi-tenancy setup — see docs/ARCHITECTURE.md.
ActsAsTenant.configure do |config|
  config.require_tenant = true
end

# Defense-in-depth: Sidekiq threads persist state across jobs on the same
# thread, so a job that bypasses ActiveJob (raw Sidekiq::Worker) could leak a
# previous job's tenant. Every background job in this app goes through
# ApplicationJob < ActiveJob::Base, which acts_as_tenant already instruments
# to serialize/restore current_tenant automatically — this middleware is a
# second, independent safety net at the Sidekiq layer itself.
require "acts_as_tenant/sidekiq"

class AuditLog < ApplicationRecord
  # Deliberately NOT acts_as_tenant: company_id is nullable here (platform-
  # level events have no company), so the fail-closed require_tenant
  # behavior would be wrong for this one table. Every write still goes
  # through Audit::Record, which always passes company_id explicitly when
  # one exists.
  self.record_timestamps = false # created_at only, set explicitly; immutable

  belongs_to :company, optional: true
  belongs_to :actor, class_name: "User", optional: true

  validates :action, presence: true

  before_create -> { self.created_at ||= Time.current }
end

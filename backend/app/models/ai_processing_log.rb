class AiProcessingLog < ApplicationRecord
  # Immutable, append-only audit trail for every AI-provider call. Unlike
  # AuditLog, company_id here is never nullable — every call happens inside
  # an ActsAsTenant.with_tenant block already (job/controller), so this
  # follows the codebase's default of acts_as_tenant on any company_id
  # column (see spec/models/tenant_scoping_spec.rb).
  acts_as_tenant(:company)
  self.record_timestamps = false

  belongs_to :company
  belongs_to :candidate_resume, optional: true
  belongs_to :candidate, optional: true
  belongs_to :job, optional: true

  validates :operation, :status, presence: true

  before_create -> { self.created_at ||= Time.current }
end

module Audit
  # Explicit, deliberate audit-log writes — never automatic before/after
  # callback diffing (see docs/ARCHITECTURE.md for why: several required
  # events like login/logout/document-download aren't model mutations at
  # all, and an explicit field allowlist means sensitive columns can never
  # accidentally leak into a diff). Callers are responsible for invoking
  # this inside the same DB transaction as the business action it records —
  # completeness matters more than latency for security/financial events,
  # so this deliberately does not enqueue a background job.
  class Record
    def self.call(...)
      new(...).call
    end

    def initialize(action:, request:, actor: Current.user, company: Current.company, auditable: nil, before_changes: nil, after_changes: nil)
      @action = action
      @actor = actor
      @company = company
      @auditable = auditable
      @before_changes = before_changes
      @after_changes = after_changes
      @request = request
    end

    def call
      AuditLog.create!(
        company: @company,
        actor: @actor,
        action: @action,
        auditable_type: @auditable&.class&.name,
        auditable_id: @auditable&.id,
        before_changes: @before_changes,
        after_changes: @after_changes,
        ip_address: @request&.remote_ip,
        user_agent: @request&.user_agent
      )
    end
  end
end

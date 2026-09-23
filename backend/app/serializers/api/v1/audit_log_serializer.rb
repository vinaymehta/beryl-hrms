module Api
  module V1
    # The diffs are passed through as stored. That is safe precisely because
    # Audit::Record never auto-diffs a model: every call site names the fields
    # it records, so nothing sensitive can reach this table and therefore
    # nothing sensitive can leave through here.
    class AuditLogSerializer < ApplicationSerializer
      attributes :id, :action, :auditable_type, :auditable_id,
                 :before_changes, :after_changes, :ip_address, :user_agent, :created_at

      attribute :actor_name do |audit_log|
        audit_log.actor&.full_name
      end

      attribute :actor_email do |audit_log|
        audit_log.actor&.email_address
      end
    end
  end
end

class AddEmployeeManagementPermissions < ActiveRecord::Migration[8.1]
  NEW_KEYS = %w[employees.manage_roles employees.manage_reporting_managers].freeze

  # Granted to whichever roles ALREADY hold employees.update — which is the
  # existing, data-driven way of saying "Admin and HR" without hard-coding
  # either slug here. A company that has since renamed or re-scoped those
  # roles from Settings gets whatever its own data says, not our assumption.
  ANCHOR_KEY = "employees.update".freeze

  # Plain SQL rather than the AR models: acts_as_tenant is configured to
  # require a current tenant (config/initializers/acts_as_tenant.rb), so a
  # Role query from inside a migration would raise, and a data migration
  # shouldn't depend on today's model code anyway.
  def up
    NEW_KEYS.each do |key|
      resource, action = key.split(".", 2)
      execute <<~SQL.squish
        INSERT INTO permissions (key, resource, action, created_at, updated_at)
        VALUES (#{quote(key)}, #{quote(resource)}, #{quote(action)}, NOW(), NOW())
        ON CONFLICT (key) DO NOTHING
      SQL
    end

    execute <<~SQL.squish
      INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
      SELECT DISTINCT existing.role_id, granted.id, NOW(), NOW()
      FROM role_permissions existing
      JOIN permissions anchor ON anchor.id = existing.permission_id AND anchor.key = #{quote(ANCHOR_KEY)}
      CROSS JOIN permissions granted
      WHERE granted.key IN (#{NEW_KEYS.map { |k| quote(k) }.join(', ')})
      ON CONFLICT DO NOTHING
    SQL
  end

  def down
    execute <<~SQL.squish
      DELETE FROM role_permissions
      WHERE permission_id IN (SELECT id FROM permissions WHERE key IN (#{NEW_KEYS.map { |k| quote(k) }.join(', ')}))
    SQL
    execute "DELETE FROM permissions WHERE key IN (#{NEW_KEYS.map { |k| quote(k) }.join(', ')})"
  end
end

# Permissions for the new Employee Types list. Granted to whichever roles
# already hold the matching departments.* key — the same data-driven "Admin
# and HR" anchor AddEmployeeManagementPermissions uses, so a company that has
# re-scoped those roles gets what its own data says.
class AddEmploymentTypePermissions < ActiveRecord::Migration[8.1]
  ACTIONS = %w[view create update delete].freeze

  def up
    ACTIONS.each do |action|
      key = "employment_types.#{action}"
      execute <<~SQL.squish
        INSERT INTO permissions (key, resource, action, created_at, updated_at)
        VALUES (#{quote(key)}, 'employment_types', #{quote(action)}, NOW(), NOW())
        ON CONFLICT (key) DO NOTHING
      SQL
      execute <<~SQL.squish
        INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
        SELECT DISTINCT existing.role_id, granted.id, NOW(), NOW()
        FROM role_permissions existing
        JOIN permissions anchor ON anchor.id = existing.permission_id AND anchor.key = #{quote("departments.#{action}")}
        CROSS JOIN permissions granted
        WHERE granted.key = #{quote(key)}
        ON CONFLICT DO NOTHING
      SQL
    end
  end

  def down
    keys = ACTIONS.map { |a| quote("employment_types.#{a}") }.join(", ")
    execute "DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE key IN (#{keys}))"
    execute "DELETE FROM permissions WHERE key IN (#{keys})"
  end
end

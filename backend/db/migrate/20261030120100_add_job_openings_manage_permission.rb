# The permission for Job Administration — the openings on the public careers
# website.
#
# Admin only. Granted to whichever roles already hold roles.manage, which is
# Admin: the same anchor AddSalarySendPermission uses. HR is deliberately not
# anchored in; a company that wants HR to edit the website's openings grants it
# from Settings.
#
# New companies need nothing here: Roles::SeedDefaults gives Admin the whole
# catalog. Plain SQL because acts_as_tenant requires a current tenant, which a
# migration has no business asserting.
class AddJobOpeningsManagePermission < ActiveRecord::Migration[8.1]
  KEY = "job_openings.manage".freeze
  ANCHOR = "roles.manage".freeze

  def up
    execute <<~SQL.squish
      INSERT INTO permissions (key, resource, action, created_at, updated_at)
      VALUES (#{quote(KEY)}, 'job_openings', 'manage', NOW(), NOW())
      ON CONFLICT (key) DO NOTHING
    SQL
    execute <<~SQL.squish
      INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
      SELECT DISTINCT existing.role_id, granted.id, NOW(), NOW()
      FROM role_permissions existing
      JOIN permissions anchor ON anchor.id = existing.permission_id AND anchor.key = #{quote(ANCHOR)}
      CROSS JOIN permissions granted
      WHERE granted.key = #{quote(KEY)}
      ON CONFLICT DO NOTHING
    SQL
  end

  def down
    execute "DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE key = #{quote(KEY)})"
    execute "DELETE FROM permissions WHERE key = #{quote(KEY)}"
  end
end

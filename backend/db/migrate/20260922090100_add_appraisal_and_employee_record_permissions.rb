# Seeds every permission key the appraisal engine and the Phase 1/5 employee
# records need, and grants them to roles that ALREADY EXIST.
#
# Roles::SeedDefaults only runs when a company registers, so without this any
# company predating these features would 403 on all of it — including Admin.
#
# Grants are derived from what a role already holds rather than from a
# hard-coded slug, so a company that has re-scoped its roles from Settings gets
# what its own data says. Plain SQL because acts_as_tenant requires a current
# tenant, which a migration has no business asserting.
class AddAppraisalAndEmployeeRecordPermissions < ActiveRecord::Migration[8.1]
  # Running the appraisal process, and administering employee records:
  # whoever already administers employee records.
  HR_KEYS = %w[
    appraisal_templates.view appraisal_templates.manage
    appraisal_cycles.view appraisal_cycles.manage
    appraisals.view_all appraisals.release
    employee_history.view assets.manage
    goals.manage skills.manage training.manage pip.manage
    appraisal_feedback.manage
  ].freeze
  HR_ANCHOR = "employees.update".freeze

  # Having an appraisal, reviewing one you have been assigned, and reading your
  # own notifications: everyone who can see the employee directory at all. The
  # keys only say "at all" — the policies decide whose.
  EVERYONE_KEYS = %w[appraisals.submit_self appraisals.review notifications.view].freeze
  EVERYONE_ANCHOR = "employees.view".freeze

  # Pay is narrower still: the roles that already hold payroll, plus Admin,
  # which holds roles.manage and would otherwise miss it entirely.
  PAY_KEYS = %w[appraisals.manage_compensation compensation.manage].freeze
  PAY_ANCHORS = %w[payroll.view roles.manage].freeze

  ALL = (HR_KEYS + EVERYONE_KEYS + PAY_KEYS).freeze

  def up
    ALL.each { |key| create_permission(key) }

    grant(HR_KEYS, anchor: HR_ANCHOR)
    grant(EVERYONE_KEYS, anchor: EVERYONE_ANCHOR)
    PAY_ANCHORS.each { |anchor| grant(PAY_KEYS, anchor: anchor) }
  end

  def down
    execute <<~SQL.squish
      DELETE FROM role_permissions
      WHERE permission_id IN (SELECT id FROM permissions WHERE key IN (#{quoted(ALL)}))
    SQL
    execute "DELETE FROM permissions WHERE key IN (#{quoted(ALL)})"
  end

  private
    def quoted(keys) = keys.map { |key| quote(key) }.join(", ")

    def create_permission(key)
      resource, action = key.split(".", 2)
      execute <<~SQL.squish
        INSERT INTO permissions (key, resource, action, created_at, updated_at)
        VALUES (#{quote(key)}, #{quote(resource)}, #{quote(action)}, NOW(), NOW())
        ON CONFLICT (key) DO NOTHING
      SQL
    end

    def grant(keys, anchor:)
      execute <<~SQL.squish
        INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
        SELECT DISTINCT existing.role_id, granted.id, NOW(), NOW()
        FROM role_permissions existing
        JOIN permissions anchor ON anchor.id = existing.permission_id AND anchor.key = #{quote(anchor)}
        CROSS JOIN permissions granted
        WHERE granted.key IN (#{quoted(keys)})
        ON CONFLICT DO NOTHING
      SQL
    end
end

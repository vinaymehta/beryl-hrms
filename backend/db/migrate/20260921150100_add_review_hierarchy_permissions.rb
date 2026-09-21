# Swaps employees.manage_reporting_managers for employees.manage_reviewers, and
# adds the two reviewer-feedback keys.
#
# Same data-driven approach as AddEmployeeManagementPermissions: grants are
# derived from what a role ALREADY holds rather than from a hard-coded slug, so
# a company that has re-scoped its roles from Settings gets what its own data
# says. Plain SQL because acts_as_tenant requires a current tenant, which a
# migration has no business asserting.
class AddReviewHierarchyPermissions < ActiveRecord::Migration[8.1]
  RETIRED_KEY = "employees.manage_reporting_managers".freeze

  # Assigning the review hierarchy, and reading everyone's feedback: the same
  # audience that already administers employee records (Admin/HR).
  MANAGEMENT_KEYS = %w[employees.manage_reviewers reviewer_feedback.view].freeze
  MANAGEMENT_ANCHOR = "employees.update".freeze

  # RECORDING feedback is not an administrative right — it belongs to whoever
  # was assigned as someone's reviewer, which is orthogonal to system role. The
  # key only says "may record feedback at all"; ReviewerFeedbackPolicy decides
  # for WHOM, and answers no unless you hold an actual assignment.
  REVIEWER_KEY = "reviewer_feedback.create".freeze
  REVIEWER_ANCHOR = "employees.view".freeze

  def up
    (MANAGEMENT_KEYS + [ REVIEWER_KEY ]).each { |key| create_permission(key) }

    grant(MANAGEMENT_KEYS, anchor: MANAGEMENT_ANCHOR)
    grant([ REVIEWER_KEY ], anchor: REVIEWER_ANCHOR)

    # Retired last, so a failure earlier leaves the old key in place rather
    # than stranding roles with neither.
    execute <<~SQL.squish
      DELETE FROM role_permissions
      WHERE permission_id IN (SELECT id FROM permissions WHERE key = #{quote(RETIRED_KEY)})
    SQL
    execute "DELETE FROM permissions WHERE key = #{quote(RETIRED_KEY)}"
  end

  def down
    create_permission(RETIRED_KEY)
    grant([ RETIRED_KEY ], anchor: MANAGEMENT_ANCHOR)

    all_new = MANAGEMENT_KEYS + [ REVIEWER_KEY ]
    execute <<~SQL.squish
      DELETE FROM role_permissions
      WHERE permission_id IN (SELECT id FROM permissions WHERE key IN (#{all_new.map { |k| quote(k) }.join(', ')}))
    SQL
    execute "DELETE FROM permissions WHERE key IN (#{all_new.map { |k| quote(k) }.join(', ')})"
  end

  private
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
        WHERE granted.key IN (#{keys.map { |k| quote(k) }.join(', ')})
        ON CONFLICT DO NOTHING
      SQL
    end
end

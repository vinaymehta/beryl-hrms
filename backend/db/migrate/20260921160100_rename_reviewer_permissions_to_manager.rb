# employees.manage_reviewers becomes employees.manage_reporting_managers, and
# the two reviewer_feedback keys are withdrawn along with the feature they
# gated. Roles keep the right they already held — only the key's name changes,
# so nobody silently loses or gains access.
class RenameReviewerPermissionsToManager < ActiveRecord::Migration[8.1]
  OLD_KEY = "employees.manage_reviewers".freeze
  NEW_KEY = "employees.manage_reporting_managers".freeze
  WITHDRAWN_KEYS = %w[reviewer_feedback.view reviewer_feedback.create].freeze

  def up
    # An in-place UPDATE, not delete-and-insert: every role_permissions row
    # pointing at it stays pointing at it, so the grant carries over by
    # construction rather than by a re-derivation that could drift.
    execute <<~SQL.squish
      UPDATE permissions
      SET key = #{quote(NEW_KEY)}, resource = 'employees', action = 'manage_reporting_managers', updated_at = NOW()
      WHERE key = #{quote(OLD_KEY)}
    SQL

    execute <<~SQL.squish
      DELETE FROM role_permissions
      WHERE permission_id IN (SELECT id FROM permissions WHERE key IN (#{WITHDRAWN_KEYS.map { |k| quote(k) }.join(', ')}))
    SQL
    execute "DELETE FROM permissions WHERE key IN (#{WITHDRAWN_KEYS.map { |k| quote(k) }.join(', ')})"
  end

  def down
    execute <<~SQL.squish
      UPDATE permissions
      SET key = #{quote(OLD_KEY)}, resource = 'employees', action = 'manage_reviewers', updated_at = NOW()
      WHERE key = #{quote(NEW_KEY)}
    SQL

    WITHDRAWN_KEYS.each do |key|
      resource, action = key.split(".", 2)
      execute <<~SQL.squish
        INSERT INTO permissions (key, resource, action, created_at, updated_at)
        VALUES (#{quote(key)}, #{quote(resource)}, #{quote(action)}, NOW(), NOW())
        ON CONFLICT (key) DO NOTHING
      SQL
    end
  end
end

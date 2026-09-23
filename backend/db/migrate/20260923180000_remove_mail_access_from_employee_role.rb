# Connecting a mailbox is not an employee's to do.
#
# `mail.view` is what ZohoConnectionPolicy#create_individual? checks, and it is
# also what puts the Mail section in Settings — so every employee was being
# offered "Connect to mailbox" for their own Zoho account. Mail in this product
# is the company's recruitment inbox, managed by HR/Admin; an employee has no
# reason to attach a personal mailbox to it.
#
# Removed from the default role (Roles::SeedDefaults) and, here, from the
# employee roles that already exist. Only those two keys and only on the
# `employee` role — a company that has deliberately granted mail access to some
# other role keeps it.
class RemoveMailAccessFromEmployeeRole < ActiveRecord::Migration[8.1]
  KEYS = %w[mail.view mail.search].freeze

  # Raw SQL on purpose: Role and RolePermission are acts_as_tenant models and
  # fail closed with NoTenantSet outside a tenant block. A migration runs
  # across every company at once, which is exactly the case that guard exists
  # to prevent — so it goes around the models rather than disabling the guard.
  def up
    execute(<<~SQL.squish)
      DELETE FROM role_permissions
      WHERE role_id IN (SELECT id FROM roles WHERE slug = 'employee')
        AND permission_id IN (
          SELECT id FROM permissions WHERE key IN (#{KEYS.map { |key| connection.quote(key) }.join(', ')})
        )
    SQL
  end

  # Deliberately irreversible: re-granting mail access on the way down would
  # hand it to every employee role, including any a company had already
  # decided should not have it.
  def down
    raise ActiveRecord::IrreversibleMigration
  end
end

# Cosmetic only, and only for the roles that still carry the name
# `slug.titleize` produced ("Hr"). Slugs — which everything actually keys off —
# are untouched, and a company that has renamed its own HR role keeps its name.
class RenameHrRoleDisplayName < ActiveRecord::Migration[8.1]
  def up
    execute "UPDATE roles SET name = 'HR', updated_at = NOW() WHERE slug = 'hr' AND name = 'Hr'"
  end

  def down
    execute "UPDATE roles SET name = 'Hr', updated_at = NOW() WHERE slug = 'hr' AND name = 'HR'"
  end
end

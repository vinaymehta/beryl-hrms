class CreatePermissions < ActiveRecord::Migration[8.1]
  def change
    # Global catalog of codebase capabilities — NOT tenant-owned. Roles
    # (tenant-owned) reference these; a tenant cannot invent new permission
    # keys, only assign the existing catalog to its own custom roles.
    create_table :permissions do |t|
      t.string :key, null: false
      t.string :resource, null: false
      t.string :action, null: false
      t.text :description

      t.timestamps
    end

    add_index :permissions, :key, unique: true
  end
end

class Permission < ApplicationRecord
  # Global catalog — intentionally NOT tenant-owned (no acts_as_tenant here).
  has_many :role_permissions, dependent: :destroy
  has_many :roles, through: :role_permissions

  validates :key, presence: true, uniqueness: true
  validates :resource, :action, presence: true
end

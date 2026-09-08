class Role < ApplicationRecord
  acts_as_tenant(:company)

  SYSTEM_DEFAULT_SLUGS = %w[admin hr account employee].freeze

  belongs_to :company
  has_many :role_permissions, dependent: :destroy
  has_many :permissions, through: :role_permissions
  has_many :user_roles, dependent: :destroy
  has_many :users, through: :user_roles

  before_validation -> { self.slug = name.to_s.parameterize if slug.blank? && name.present? }

  validates :name, presence: true
  validates :slug, presence: true, uniqueness: { scope: :company_id }

  before_destroy :ensure_not_system_default

  private
    def ensure_not_system_default
      return unless system_default?

      errors.add(:base, "system default roles cannot be deleted")
      throw :abort
    end
end

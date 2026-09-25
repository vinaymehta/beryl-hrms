class User < ApplicationRecord
  acts_as_tenant(:company)

  has_secure_password

  belongs_to :company
  has_many :sessions, dependent: :destroy
  has_many :user_roles, dependent: :destroy
  has_many :roles, through: :user_roles
  has_one :employee_record, class_name: "Employee", foreign_key: :user_id, inverse_of: :user, dependent: :nullify
  has_many :notifications, dependent: :destroy

  enum :status, { invited: 0, active: 1, disabled: 2 }, default: :invited

  normalizes :email_address, with: ->(e) { e.strip.downcase }

  # Invalidated automatically when email_address changes (a stale link can't
  # verify a since-changed address). Uses the same ActiveRecord::TokenFor
  # primitive has_secure_password's own reset_token option is built on.
  generates_token_for :email_verification, expires_in: 24.hours do
    email_address
  end

  MINIMUM_PASSWORD_LENGTH = 8

  # Enforced on the MODEL, not only in the forms that happen to ask for one.
  # There are several ways a password gets set — registration, a self-service
  # reset, an administrator issuing one — and a rule living in some of those
  # screens and not others is a rule with a hole in it.
  validates :password, length: { minimum: MINIMUM_PASSWORD_LENGTH }, if: -> { password.present? }
  validates :first_name, :last_name, presence: true
  validates :email_address, uniqueness: true

  def full_name
    "#{first_name} #{last_name}".strip
  end

  def verified?
    email_verified_at.present?
  end

  # Provisioned by Admin/HR, but nobody has sent them a password yet — so
  # there is nothing they could sign in with.
  def credentials_unsent?
    credentials_sent_at.nil?
  end

  # Whether this account may sign in at all. An account that has never been
  # sent a password holds a random secret nobody has ever seen, so this is
  # belt-and-braces there; for a disabled one it is the whole control.
  def sign_in_allowed?
    active?
  end

  # The inverse of #permission?: everyone who holds a permission, rather than
  # whether one person holds it. Needed by notifications addressed to a duty
  # ("whoever may release this") rather than to a named individual — the
  # appraisal workflow's reviewers are snapshotted on the appraisal, but its
  # HR steps are not, so they can only be found this way.
  scope :with_permission, ->(key) {
    where(status: :active)
      .where(id: UserRole.joins(role: { role_permissions: :permission })
                         .where(permissions: { key: key.to_s })
                         .select(:user_id))
  }

  # Fresh (non-memoized) lookup — general purpose. The hot request path uses
  # Current.permissions instead, which memoizes this once per request.
  def permission_keys
    Permission
      .joins(role_permissions: { role: :user_roles })
      .where(user_roles: { user_id: id })
      .distinct
      .pluck(:key)
      .to_set
  end

  def permission?(key)
    permission_keys.include?(key.to_s)
  end
end

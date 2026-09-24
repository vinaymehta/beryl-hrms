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

  # How long an invitation link stays usable. Days rather than the 15 minutes
  # has_secure_password's reset token allows: a reset is something you asked
  # for seconds ago and are waiting on, an invitation lands in the inbox of
  # someone who may not be at their desk, and an expiry they routinely miss
  # just trains everybody to ask for another one.
  INVITATION_VALID_FOR = 7.days

  # The first-login link. Single-use and re-issuable, both enforced by what
  # the payload is made of rather than by a stored flag:
  #
  #   password_salt  changes the moment a password is set, so the link that
  #                  set it stops working — that is what makes it single-use,
  #                  and it also kills the link if the person is sent a reset
  #                  in the meantime.
  #   invited_at     changes every time Admin clicks Invite again, so an
  #                  older email in the mailbox can't be used instead of the
  #                  newest one.
  #
  # Same ActiveRecord::TokenFor primitive as :email_verification above and as
  # has_secure_password's own reset token. Nothing is stored: the token is
  # signed, so there is no plaintext secret in the database to leak.
  generates_token_for :invitation, expires_in: INVITATION_VALID_FOR do
    # Microseconds, not seconds: Admin clicking Invite twice in the same second
    # is an ordinary mis-click, and at whole-second resolution both clicks
    # produce the SAME token — which would leave the supposedly-superseded link
    # working. The column stores microseconds, so the value is stable across a
    # reload.
    "#{password_salt&.last(10)}/#{invited_at&.utc&.strftime('%Y%m%d%H%M%S%6N')}"
  end

  validates :first_name, :last_name, presence: true
  validates :email_address, uniqueness: true

  def full_name
    "#{first_name} #{last_name}".strip
  end

  def verified?
    email_verified_at.present?
  end

  # Invited, sent a link, and hasn't finished setting a password yet.
  def invitation_pending?
    invited_at.present? && invitation_accepted_at.nil?
  end

  # Created by Admin/HR but never actually sent the email.
  def invitation_unsent?
    invited_at.nil? && invitation_accepted_at.nil? && invited?
  end

  # Whether this account may sign in at all. An invited account holds a random
  # password nobody has ever seen, so this is belt-and-braces there; for a
  # disabled one it is the whole control.
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

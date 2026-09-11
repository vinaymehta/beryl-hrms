class ZohoConnection < ApplicationRecord
  acts_as_tenant(:company)

  # Schema shell only — Phase 4 builds the OAuth flow/controllers that
  # populate and use this. Tokens are encrypted at rest via Active Record
  # Encryption (no extra gem) and are excluded from audit logging by
  # Audit::Record's explicit field allowlist, so they can never leak into a
  # before/after diff.
  # Named company_managed/individual (not "company") to avoid any ambiguity
  # with the `belongs_to :company` association on this same model.
  enum :connection_type, { company_managed: 0, individual: 1 }
  enum :status, { active: 0, revoked: 1, error: 2 }, default: :active

  # `last_synced_at`: the cursor for automatic new-mail scanning (see
  # ZohoAutoScanJob) — the point in time up to which this mailbox's inbox
  # has already been incrementally, successfully scanned. It is a
  # forward-moving cursor, NOT a historical range: no date range is stored
  # per connection at all any more (the Mail page's own date filter is the
  # single source of truth for historical fetching), and nothing the user
  # picks there ever touches this cursor.

  belongs_to :company
  belongs_to :user, optional: true

  encrypts :access_token
  encrypts :refresh_token

  validates :email_address, presence: true
end

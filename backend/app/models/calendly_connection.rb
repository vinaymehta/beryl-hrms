class CalendlyConnection < ApplicationRecord
  acts_as_tenant(:company)

  belongs_to :company
  # Who connected it. Optional for the same reason ZohoConnection's is: the
  # connection belongs to the company, not to whoever happened to click connect.
  belongs_to :user, optional: true

  # Encrypted at rest via Active Record Encryption, exactly as ZohoConnection
  # does — these are long-lived credentials for an external calendar.
  encrypts :access_token
  encrypts :refresh_token

  enum :status, { active: 0, revoked: 1, error: 2 }, default: :active

  validates :organization_uri, presence: true

  # Calendly access tokens are short-lived; refresh a little early so a booking
  # link isn't generated with a token that expires mid-request.
  REFRESH_WINDOW = 5.minutes

  def token_expired?
    token_expires_at.present? && token_expires_at <= Time.current + REFRESH_WINDOW
  end

  # True only when this connection can actually produce booking links: it needs
  # a live token AND an event type to book against.
  def ready?
    active? && access_token.present? && default_event_type_uri.present?
  end
end

class Session < ApplicationRecord
  belongs_to :user

  before_create -> { self.expires_at ||= 30.days.from_now }

  scope :active, -> { where("expires_at IS NULL OR expires_at > ?", Time.current) }

  def expired?
    expires_at.present? && expires_at <= Time.current
  end
end

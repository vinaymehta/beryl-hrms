# In-app notification. Generic on purpose: the appraisal workflow is the first
# producer, but nothing here is appraisal-specific, so the next feature that
# needs to tell someone something reuses this rather than building a second one.
#
# Addressed to a User (not an Employee) because it is the login that reads it.
class Notification < ApplicationRecord
  acts_as_tenant(:company)

  belongs_to :company
  belongs_to :user
  belongs_to :notifiable, polymorphic: true, optional: true

  validates :category, :title, presence: true

  scope :unread, -> { where(read_at: nil) }
  scope :newest_first, -> { order(created_at: :desc) }

  def read? = read_at.present?

  def mark_read!
    update!(read_at: Time.current) unless read?
  end
end

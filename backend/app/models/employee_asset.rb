# A company asset (§3). `employee` is optional so an unassigned item can sit in
# the pool — which is why this one doesn't use EmployeeOwned.
class EmployeeAsset < ApplicationRecord
  acts_as_tenant(:company)

  enum :asset_type, { laptop: 0, phone: 1, monitor: 2, accessory: 3, access_card: 4, other: 5 },
       prefix: true, default: :laptop, validate: true
  enum :status, { assigned: 0, returned: 1, lost: 2, retired: 3 },
       default: :assigned, validate: true

  belongs_to :company
  belongs_to :employee, optional: true

  validates :name, presence: true
  validate :returned_needs_a_date

  scope :newest_first, -> { order(created_at: :desc) }

  private
    def returned_needs_a_date
      return unless returned? && returned_on.blank?

      errors.add(:returned_on, "is required once an asset is returned")
    end
end

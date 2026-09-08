class LeaveRequest < ApplicationRecord
  acts_as_tenant(:company)

  enum :status, { pending: 0, approved: 1, rejected: 2 }, default: :pending

  belongs_to :company
  belongs_to :employee
  belongs_to :approved_by, class_name: "User", optional: true

  validates :leave_type, :start_date, :end_date, presence: true
  validate :end_date_not_before_start_date

  private
    def end_date_not_before_start_date
      return if start_date.blank? || end_date.blank?

      errors.add(:end_date, "can't be before the start date") if end_date < start_date
    end
end

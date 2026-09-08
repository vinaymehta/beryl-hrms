class AttendanceRecord < ApplicationRecord
  acts_as_tenant(:company)

  enum :status, { present: 0, absent: 1, half_day: 2, on_leave: 3 }, default: :present

  belongs_to :company
  belongs_to :employee

  validates :date, presence: true, uniqueness: { scope: :employee_id }
end

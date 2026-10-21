# One employee's salary slip for one month, as generated on the Salary page:
# the PDF Salary::SlipPdf rendered, the three amounts it printed, and — once
# SalarySlipJob has mailed it — when and to whom it went.
#
# `generated` → `sent`. Regenerating a sent slip (Salary::SlipGenerator)
# puts it back to `generated`: the new PDF hasn't been sent to anyone.
class SalarySlip < ApplicationRecord
  acts_as_tenant(:company)

  enum :status, { generated: 0, sent: 1 }, default: :generated, validate: true

  belongs_to :company
  belongs_to :employee
  belongs_to :generated_by, class_name: "User", optional: true
  belongs_to :sent_by, class_name: "User", optional: true

  has_one_attached :pdf

  validates :month, presence: true, uniqueness: { scope: :employee_id }
  validates :gross, :deductions, :net, :generated_at, presence: true
  validate :month_is_first_of_month

  private
    def month_is_first_of_month
      errors.add(:month, "must be the first of the month") if month && month.day != 1
    end
end

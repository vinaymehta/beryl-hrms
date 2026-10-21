# The Salary page's pay run: every employee's monthly pay, their generated
# slips, and sending them. Headless (`authorize :salary`) — the run is a month,
# not a record — and one key for all of it, because the run exists only to get
# slips out, and it shows pay that nobody else in the app sees in bulk.
class SalaryPolicy < ApplicationPolicy
  def index? = permission?("salary.send")

  def create? = index?
end

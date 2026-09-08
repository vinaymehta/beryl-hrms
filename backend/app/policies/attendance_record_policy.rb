class AttendanceRecordPolicy < ApplicationPolicy
  def index? = permission?("attendance.view")
  def show? = permission?("attendance.view")
  # Checking in/out is "managing" attendance, same permission an HR/Admin
  # uses to manage anyone else's — the seeded Employee role only carries
  # attendance.view, not .manage, in this pass (see Roles::SeedDefaults).
  def check_in? = permission?("attendance.manage")
  def check_out? = permission?("attendance.manage")

  class Scope < ApplicationPolicy::Scope
    def resolve
      base = scope.where(company_id: user.company_id)
      return base if user.permission?("attendance.manage")

      base.where(employee_id: user.employee_record&.id)
    end
  end
end

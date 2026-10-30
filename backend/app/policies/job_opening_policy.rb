# Job Administration: the openings on the public careers website. One key for
# all of it — whoever may edit what the website says may also publish, pause
# and remove it. Admin only by default (AddJobOpeningsManagePermission).
class JobOpeningPolicy < ApplicationPolicy
  def index? = permission?("job_openings.manage")
  def show? = index?
  def create? = index?
  def update? = index?
  def destroy? = index?
  def reorder? = index?

  class Scope < ApplicationPolicy::Scope
    # Single-company table (no company_id): everything, for whoever passed the
    # policy check above.
    def resolve
      scope.all
    end
  end
end

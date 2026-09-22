# Optional 360° feedback (§21).
#
# Two distinct actors, which is why this doesn't use EmployeeRecordPolicy:
# an ADMINISTRATOR requests feedback, and the person it was requested FROM
# answers it. Neither can do the other's half.
class AppraisalFeedbackRequestPolicy < ApplicationPolicy
  def index? = permission?("appraisal_feedback.manage") || addressed_to_me?
  def create? = permission?("appraisal_feedback.manage")
  def destroy? = create?

  # Only the person asked may answer, and only while it is still outstanding.
  def respond? = addressed_to_me? && record.respond_to?(:pending?) && record.pending?

  class Scope < ApplicationPolicy::Scope
    def resolve
      base = scope.where(company_id: user.company_id)
      return base if user.permission?("appraisal_feedback.manage")

      base.where(requested_from_id: user.employee_record&.id)
    end
  end

  private
    def addressed_to_me?
      own_id = user&.employee_record&.id
      own_id.present? && record.respond_to?(:requested_from_id) && record.requested_from_id == own_id
    end
end

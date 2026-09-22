# Comment visibility, enforced in the SCOPE rather than in a view: a
# management_only row never reaches an employee's response at all.
class AppraisalCommentPolicy < ApplicationPolicy
  def create?
    appraisal_policy.administrator? || appraisal_policy.reviewer? || appraisal_policy.subject?
  end

  # Only management may mark a comment management-only; an employee's own
  # comment is, by definition, one they can see.
  def may_set_management_only?
    appraisal_policy.administrator? || appraisal_policy.reviewer?
  end

  private
    def appraisal_policy
      @appraisal_policy ||= AppraisalPolicy.new(user, record.is_a?(AppraisalComment) ? record.appraisal : record)
    end

  public

  class Scope < ApplicationPolicy::Scope
    def resolve
      base = scope.where(company_id: user.company_id)
      return base if user.permission?("appraisals.view_all")

      own_id = user.employee_record&.id
      return base.none if own_id.nil?

      # A reviewer sees everything on the appraisals they review. The subject
      # sees employee-visible comments, and only once the appraisal is released.
      reviewed = Appraisal.for_reviewer(own_id).select(:id)
      released_own = Appraisal.where(employee_id: own_id).where.not(released_at: nil).select(:id)

      base.where(appraisal_id: reviewed)
          .or(base.where(appraisal_id: released_own, visibility: AppraisalComment.visibilities[:employee_visible]))
    end
  end
end

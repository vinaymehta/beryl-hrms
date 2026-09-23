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

      # You can always read what you wrote. Listed first because it is the one
      # clause that does not depend on having an employee record: it is about
      # authorship, not about your place in the appraisal.
      #
      # Safe to OR in unconditionally — it can't widen which APPRAISALS you can
      # open. DetailPresenter only ever resolves this against the comments of
      # one appraisal the viewer has already passed AppraisalPolicy#show? for.
      own_authored = base.where(author_user_id: user.id)

      own_id = user.employee_record&.id
      return own_authored if own_id.nil?

      # A reviewer sees everything on the appraisals they review; the subject
      # sees the comments marked for them on their own.
      #
      # NOT gated on release. It used to be, which is what stopped an employee
      # seeing any comment at all before their appraisal was released —
      # including one they had just written themselves. A comment a manager
      # deliberately marked `employee_visible` is one they meant the employee
      # to read, and the UI labels it "Employee visible" to both of them; a
      # gate that made that label untrue until release was the bug, not the
      # protection. `management_only` is the boundary that matters, and it is
      # untouched.
      reviewed = Appraisal.for_reviewer(own_id).select(:id)
      own_appraisals = Appraisal.where(employee_id: own_id).select(:id)

      base.where(appraisal_id: reviewed)
          .or(base.where(appraisal_id: own_appraisals, visibility: AppraisalComment.visibilities[:employee_visible]))
          .or(own_authored)
    end
  end
end

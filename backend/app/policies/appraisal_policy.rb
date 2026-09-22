# The visibility rules of the whole feature, in one class.
#
# Three distinct relationships a user can have with an appraisal, and they are
# NOT interchangeable:
#
#   subject   — it is about them. Sees their own self-appraisal and the status
#               at all times; sees the final version and employee-visible
#               comments only AFTER release; never sees a manager's ratings
#               before then, and never sees management-only comments at all.
#   reviewer  — primary / secondary / final, from the snapshot on the appraisal.
#               Sees the versions their step depends on.
#   administrator — holds appraisals.view_all (HR/Admin).
#
# Being a reviewer is an assignment carried on the appraisal, not a system role,
# so it grants nothing beyond the appraisals it names.
class AppraisalPolicy < ApplicationPolicy
  def index? = permission?("appraisals.view_all") || permission?("appraisals.submit_self") || permission?("appraisals.review")

  def show?
    administrator? || subject? || reviewer?
  end

  # The employee filling in their own V1.
  def submit_self?
    permission?("appraisals.submit_self") && subject? && !record.employee_locked?
  end

  def save_self_draft? = submit_self?

  # A reviewer submitting their own independent version, at the stage they own.
  def submit_review?
    return false unless permission?("appraisals.review")

    current_stage_reviewer?
  end

  def return_for_correction?
    administrator? || current_stage_reviewer?
  end

  def advance? = administrator? || current_stage_reviewer?

  # Calibration belongs to the final reviewer (and to HR/Admin).
  def override_score?
    administrator? || my_level == "final"
  end

  def release? = permission?("appraisals.release")

  def acknowledge?
    subject? && record.released? && record.acknowledged_at.nil?
  end

  def manage_compensation? = permission?("appraisals.manage_compensation")

  # Whether this viewer may see the restricted compensation block at all.
  def view_compensation? = manage_compensation?

  # --- Version visibility ---------------------------------------------------
  # Which revisions this viewer may read. The employee's pre-release view is the
  # strict case: their OWN self-appraisal and nothing else.
  def visible_revision_stages
    return AppraisalRevision.stages.keys if administrator?

    case my_level
    when "primary" then %w[self_appraisal primary_review]
    when "secondary" then %w[self_appraisal primary_review secondary_review]
    when "final" then AppraisalRevision.stages.keys
    else
      return %w[self_appraisal final_review] if subject? && record.released?

      subject? ? %w[self_appraisal] : []
    end
  end

  def administrator? = permission?("appraisals.view_all")

  def subject?
    same_company? && record.employee_id.present? && record.employee_id == user.employee_record&.id
  end

  def reviewer? = my_level.present?

  def my_level
    return nil unless same_company?

    @my_level ||= record.reviewer_level_for(user.employee_record&.id)
  end

  private
    # A reviewer may only act at the stage the appraisal is actually sitting at —
    # the final manager can't file their calibration while the primary review is
    # still outstanding.
    def current_stage_reviewer?
      case record.status
      when "primary_review" then my_level == "primary"
      when "secondary_review" then my_level == "secondary"
      when "final_review", "appraisal_discussion", "compensation_approval" then my_level == "final"
      else false
      end
    end

  public

  class Scope < ApplicationPolicy::Scope
    # Administrators see the company's appraisals; everyone else sees their own
    # plus the ones assigned to them as a reviewer. Enforced in the query, so no
    # controller can widen it by forgetting a filter.
    def resolve
      base = scope.where(company_id: user.company_id)
      return base if user.permission?("appraisals.view_all")

      own_id = user.employee_record&.id
      return base.none if own_id.nil?

      base.where(employee_id: own_id)
          .or(base.where(primary_manager_id: own_id))
          .or(base.where(secondary_manager_id: own_id))
          .or(base.where(final_manager_id: own_id))
    end
  end
end

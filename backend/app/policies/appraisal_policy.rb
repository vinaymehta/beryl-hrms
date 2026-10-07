# The visibility rules of the whole feature, in one class.
#
# Three distinct relationships a user can have with an appraisal, and they are
# NOT interchangeable:
#
#   subject   — it is about them. Sees their own self-appraisal and the status
#               at all times, and their appraisal letter and employee-visible
#               comments only AFTER release. Never sees a manager's review or
#               the final review, never sees a score (see #hide_scores?), and
#               never sees management-only comments at all.
#   reviewer  — a manager at some level of the appraisal's reviewer chain
#               (Appraisal#reviewer_ids). Sees the self-appraisal and the
#               reviews up to their own level.
#   administrator — holds appraisals.view_all (HR/Admin). Does the Final
#               review, after every manager level.
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

  # Saving a review in progress — exactly who may submit it.
  def save_review_draft? = submit_review?

  # A reviewer submitting their own independent version, at the stage they own.
  # The Discussion step's increment / promotion choice: Admin/HR, before release.
  def save_discussion? = administrator? && record.appraisal_discussion?

  # Only at a step that takes a review — a manager level or the Final review.
  # Discussion is a checkpoint before release, with no form: Admin/HR still
  # own it (advance, return, release), but there is nothing to submit there.
  def submit_review?
    return false unless permission?("appraisals.review")
    return false unless record.manager_review? || record.final_review?

    current_stage_reviewer?
  end

  def return_for_correction?
    administrator? || current_stage_reviewer?
  end

  def advance? = administrator? || current_stage_reviewer?

  # Calibration belongs to the Final review, which is Admin/HR's.
  def override_score? = administrator?

  def release? = permission?("appraisals.release")

  def acknowledge?
    subject? && record.released? && record.acknowledged_at.nil?
  end

  # Signing the appraisal letter, which is how the subject acknowledges now:
  # the same person at the same moment as #acknowledge?, and only while the
  # appraisal is still sitting at Released with a letter to sign. Signed once —
  # acknowledged_at is set by the signing, so a second attempt is refused here.
  def sign?
    # The status, not Appraisal#released? — that one reads released_at, which
    # stays set once the appraisal has moved on to Closed.
    acknowledge? && record.status == "released" && record.letter_pdf.attached?
  end

  # --- The appraisal letter ---------------------------------------------------
  # Who may see the letter block and open the letter: the subject once it has
  # been released to them, Admin/HR always, and a reviewer once it is signed
  # (the outcome of the appraisal they reviewed, not before the employee has
  # accepted it).
  def view_letter?
    (subject? && record.released?) || administrator? || (reviewer? && record.letter_signed?)
  end

  # A preview of the letter from the saved decision, before it is issued.
  def preview_letter? = administrator? && record.appraisal_discussion?

  # Scores are management's working, not the employee's outcome — the letter
  # is that. Hidden from the subject at every stage, unless they are Admin/HR
  # themselves.
  def hide_scores? = subject? && !administrator?

  def manage_compensation? = permission?("appraisals.manage_compensation")

  # Whether this viewer may see the restricted compensation block at all.
  def view_compensation? = manage_compensation?

  # --- Version visibility ---------------------------------------------------
  # Which revisions this viewer may read. The employee's view is the strict
  # case: their OWN self-appraisal and nothing else, before release and after
  # it — what release gives them is the appraisal letter, not the final review.
  def visible_revision_stages
    return AppraisalRevision.stages.keys if administrator?
    return %w[self_appraisal manager_review primary_review secondary_review] if reviewer?

    subject? ? %w[self_appraisal] : []
  end

  # Finer than the stage list: a manager reads the reviews of their own level
  # and the levels below it — what their review builds on — not the ones after.
  def visible_revision?(revision)
    return false unless visible_revision_stages.include?(revision.stage)
    return true if administrator? || !reviewer?
    return true unless revision.stage == "manager_review"

    revision.review_level.to_i <= my_level.to_i
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
    # The Final review and discussion are Admin/HR's; each manager level acts
    # only when it is that level's turn.
    def current_stage_reviewer?
      case record.status
      when "manager_review" then my_level.present? && my_level == record.review_level
      when "final_review", "appraisal_discussion", "compensation_approval" then administrator?
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

      base.where(employee_id: own_id).or(base.for_reviewer(own_id))
    end
  end
end

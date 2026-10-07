module Api
  module V1
    # List shape. Carries no revision content: a list has no business shipping
    # ratings the viewer may not be permitted to read.
    #
    # Nor scores to the employee they are about (AppraisalPolicy#hide_scores?).
    # The caller says whose scores to blank with
    # `params: { hide_scores_for_employee_id: }` — the viewer's own employee id
    # unless they are Admin/HR — because this serializer is shared by the list
    # (many rows, one viewer) and the detail page, and only some rows are the
    # viewer's own.
    class AppraisalSummarySerializer < ApplicationSerializer
      attributes :id, :status, :appraisal_cycle_id, :employee_id, :released_at, :acknowledged_at

      attribute :calculated_score do |appraisal|
        appraisal.calculated_score unless scores_hidden?(appraisal)
      end
      attribute :final_score do |appraisal|
        appraisal.final_score unless scores_hidden?(appraisal)
      end

      attribute :cycle_name do |appraisal|
        appraisal.appraisal_cycle&.name
      end
      attribute :employee_name do |appraisal|
        appraisal.employee&.full_name
      end
      attribute :employee_code do |appraisal|
        appraisal.employee&.employee_code
      end
      attribute :effective_score do |appraisal|
        appraisal.effective_score unless scores_hidden?(appraisal)
      end
      # The reviewer chain, level 1 first, and whose turn it is. The timeline
      # draws one step per level from this.
      attribute :review_level, &:review_level
      attribute :reviewer_names do |appraisal|
        appraisal.reviewers.map(&:full_name)
      end
      attribute :primary_manager_name do |appraisal|
        appraisal.reviewers.first&.full_name
      end
      attribute :current_version do |appraisal|
        appraisal.revisions.map(&:version_number).max
      end

      private
        def scores_hidden?(appraisal)
          hidden_for = params[:hide_scores_for_employee_id]
          hidden_for.present? && appraisal.employee_id == hidden_for
        end
    end
  end
end

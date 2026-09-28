module Api
  module V1
    # List shape. Carries no revision content: a list has no business shipping
    # ratings the viewer may not be permitted to read.
    class AppraisalSummarySerializer < ApplicationSerializer
      attributes :id, :status, :appraisal_cycle_id, :employee_id,
                 :calculated_score, :final_score, :released_at, :acknowledged_at

      attribute :cycle_name do |appraisal|
        appraisal.appraisal_cycle&.name
      end
      attribute :employee_name do |appraisal|
        appraisal.employee&.full_name
      end
      attribute :employee_code do |appraisal|
        appraisal.employee&.employee_code
      end
      attribute :effective_score, &:effective_score
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
    end
  end
end

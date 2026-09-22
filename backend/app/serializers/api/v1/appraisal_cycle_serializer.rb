module Api
  module V1
    class AppraisalCycleSerializer < ApplicationSerializer
      attributes :id, :name, :description, :status,
                 :assessment_period_start, :assessment_period_end, :starts_on,
                 :employee_submission_deadline, :primary_review_deadline,
                 :secondary_review_deadline, :finalization_deadline,
                 :compensation_effective_date, :secondary_review_enabled,
                 :appraisal_template_id, :started_at, :closed_at, :created_at

      attribute :template_name do |cycle|
        cycle.appraisal_template&.name
      end
      attribute :template_version do |cycle|
        cycle.appraisal_template&.version
      end
      attribute :started, &:started?

      attribute :eligible_count do |cycle|
        cycle.participants.size
      end
      attribute :appraisal_count do |cycle|
        cycle.appraisals.size
      end
      # {status => count}, for the progress bar on the cycle card.
      attribute :status_counts do |cycle|
        cycle.appraisals.group_by(&:status).transform_values(&:size)
      end
    end
  end
end

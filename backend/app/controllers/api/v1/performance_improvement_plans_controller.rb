module Api
  module V1
    # §23. A separate, permission-controlled workflow — deliberately outside the
    # appraisal state machine, since a PIP can be opened with no appraisal in
    # flight.
    class PerformanceImprovementPlansController < Api::V1::BaseController
      include EmployeeSubresource

      employee_subresource(
        model: PerformanceImprovementPlan, association: :improvement_plans,
        params: %i[issue_description expected_improvement measurable_targets support_provided
                   employee_comments outcome_note status starts_on review_on closed_on]
      )

      private
        def record_params
          params[:id].present? ? super : super.merge(opened_by: Current.user)
        end
    end
  end
end

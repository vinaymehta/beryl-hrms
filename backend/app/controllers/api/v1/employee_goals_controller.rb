module Api
  module V1
    # §19. Goals can come out of a finalized appraisal (source_appraisal) or be
    # set independently.
    class EmployeeGoalsController < Api::V1::BaseController
      include EmployeeSubresource

      employee_subresource(
        model: EmployeeGoal, association: :goals,
        params: %i[title description success_criteria priority status target_date
                   progress_note manager_comment source_appraisal_id]
      )

      private
        def record_params
          params[:id].present? ? super : super.merge(created_by: Current.user)
        end
    end
  end
end

module Api
  module V1
    # §20 training, moving through Identified → Assigned → Completed →
    # Manager Validated.
    class EmployeeTrainingsController < Api::V1::BaseController
      include EmployeeSubresource

      employee_subresource(
        model: EmployeeTraining, association: :trainings,
        params: %i[name description status identified_on completed_on source_appraisal_id]
      )
    end
  end
end

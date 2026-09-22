module Api
  module V1
    # Restricted (§3, §17): gated on compensation.manage, and not readable by
    # the employee themselves — see EmployeeCompensationRecordPolicy.
    class EmployeeCompensationRecordsController < Api::V1::BaseController
      include EmployeeSubresource

      employee_subresource(
        model: EmployeeCompensationRecord, association: :compensation_records,
        params: %i[annual_compensation increment_percentage effective_on reason note appraisal_id],
        order: :chronological
      )

      private
        def record_params
          super.merge(recorded_by: Current.user)
        end
    end
  end
end

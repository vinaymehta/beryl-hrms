module Api
  module V1
    # Read-only: employment history is written by Employee callbacks and is
    # immutable, so there is deliberately no create/update/destroy route.
    class EmployeeEmploymentEventsController < Api::V1::BaseController
      include EmployeeSubresource

      employee_subresource(
        model: EmployeeEmploymentEvent, association: :employment_events, params: [], order: :chronological
      )
    end
  end
end

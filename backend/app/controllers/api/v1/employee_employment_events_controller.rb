module Api
  module V1
    # Read-only: employment history is written by Employee callbacks and is
    # immutable, so there is deliberately no create/update/destroy route.
    class EmployeeEmploymentEventsController < Api::V1::BaseController
      include EmployeeSubresource

      # `recorded_by_name` — who made the change, which matters most for the
      # entries an employee writes by editing their own profile.
      employee_subresource(
        model: EmployeeEmploymentEvent, association: :employment_events, params: [], order: :chronological,
        methods: [ :recorded_by_name ], includes: [ { recorded_by: :employee_record } ]
      )
    end
  end
end

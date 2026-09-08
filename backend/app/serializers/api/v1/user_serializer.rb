module Api
  module V1
    class UserSerializer < ApplicationSerializer
      attributes :id, :first_name, :last_name, :email_verified_at, :status

      # Exposed as "email" (not "emailAddress") even though the Rails-side
      # attribute is email_address — matches the frontend's API contract.
      attribute :email, &:email_address

      # Nullable — not every User has a linked Employee record. Lets the
      # frontend self-scope attendance/leave/documents calls to "my own
      # employee record" without a separate lookup.
      attribute :employee_id do |user|
        user.employee_record&.id
      end
    end
  end
end

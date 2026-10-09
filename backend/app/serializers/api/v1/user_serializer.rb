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

      # The linked employee's profile photo (Active Storage path), for the avatar in the top bar. Nil without one.
      attribute :profile_photo_url do |user|
        photo = user.employee_record&.profile_photo
        photo&.attached? ? Rails.application.routes.url_helpers.rails_blob_path(photo, only_path: true) : nil
      end
    end
  end
end

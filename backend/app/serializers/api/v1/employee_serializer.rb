module Api
  module V1
    class EmployeeSerializer < ApplicationSerializer
      attributes :id, :employee_code, :first_name, :last_name, :status, :date_of_joining,
                 :date_of_birth, :gender, :phone, :personal_email,
                 :address_line1, :address_line2, :city, :state, :postal_code, :country,
                 :emergency_contact_name, :emergency_contact_phone,
                 :user_id, :department_id, :designation_id

      attribute :full_name, &:full_name

      one :department, resource: Api::V1::DepartmentSerializer
      one :designation, resource: Api::V1::DesignationSerializer

      # Active Storage's own signed/expiring blob route (not a raw S3/public
      # URL) — a lighter touch than the fully Pundit-gated download flow
      # built for Documents, since a profile photo isn't sensitive the way
      # payslips/contracts are.
      attribute :profile_photo_url do |employee|
        employee.profile_photo.attached? ? Rails.application.routes.url_helpers.rails_blob_path(employee.profile_photo, only_path: true) : nil
      end
    end
  end
end

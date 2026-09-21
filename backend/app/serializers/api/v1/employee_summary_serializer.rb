module Api
  module V1
    # The compact shape an Employee takes when it appears INSIDE another
    # record — today, as one of an employee's reporting managers. Kept
    # separate from EmployeeSerializer so nesting can never recurse (a
    # manager's own managers are not embedded) and so a reporting line never
    # leaks a colleague's address, date of birth or emergency contact.
    class EmployeeSummarySerializer < ApplicationSerializer
      attributes :id, :employee_code, :status, :current_level

      attribute :full_name, &:full_name
      attribute :designation_title do |employee|
        employee.designation&.title
      end
      attribute :department_name do |employee|
        employee.department&.name
      end
      attribute :profile_photo_url do |employee|
        employee.profile_photo.attached? ? Rails.application.routes.url_helpers.rails_blob_path(employee.profile_photo, only_path: true) : nil
      end
    end
  end
end

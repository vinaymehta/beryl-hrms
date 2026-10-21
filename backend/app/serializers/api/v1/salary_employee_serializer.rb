module Api
  module V1
    # One row of a month's pay run on the Salary page — a Salary::Run::Row:
    # the employee, what they are paid, what stands in the way of their slip,
    # and the slip once generated.
    class SalaryEmployeeSerializer < ApplicationSerializer
      attribute(:id) { |row| row.employee.id }
      attribute(:employee_code) { |row| row.employee.employee_code }
      attribute(:full_name) { |row| row.employee.full_name }
      attribute(:designation_title) { |row| row.employee.designation&.title }
      attribute(:department_name) { |row| row.employee.department&.name }
      attribute :profile_photo_url do |row|
        photo = row.employee.profile_photo
        photo.attached? ? Rails.application.routes.url_helpers.rails_blob_path(photo, only_path: true) : nil
      end
      attribute(:salary_on_file) { |row| row.decision.present? }
      attribute(:recipient_email, &:recipient)
      # Blocking ones (Salary::Run::BLOCKING) and warnings alike, in that order.
      attribute(:issues, &:issues)
      attribute(:eligible, &:eligible?)

      # What a slip prints from the salary on file today; null, not 0, without
      # one. A generated slip carries its own figures under `slip`.
      %i[gross deductions net].each do |key|
        attribute(:"monthly_#{key}") do |row|
          row.projected && ::Appraisals::SalaryStructure.storable(row.projected[key].round(2))
        end
      end

      attribute :slip do |row|
        row.slip && Api::V1::SalarySlipSerializer.new(row.slip, params: { outdated: row.outdated? }).to_h
      end
    end
  end
end

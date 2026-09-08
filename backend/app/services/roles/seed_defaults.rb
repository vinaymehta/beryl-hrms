module Roles
  # Creates the 4 default roles (Admin/HR/Account/Employee) for a newly
  # registered company, with a starter permission set per role. All 4 are
  # `system_default: true` (non-deletable) but are otherwise ordinary
  # tenant-owned roles — an admin can edit their permissions or add more
  # roles later; nothing elsewhere in the app branches on these names.
  class SeedDefaults
    DEFAULT_ROLE_PERMISSIONS = {
      "admin" => :all,
      "hr" => %w[
        employees.view employees.create employees.update employees.delete
        departments.view departments.create departments.update departments.delete
        designations.view designations.create designations.update designations.delete
        attendance.view attendance.manage
        leave.view leave.create leave.approve
        documents.view documents.create documents.delete
        audit_logs.view
      ],
      "account" => %w[
        employees.view
        payroll.view payroll.manage
        expenses.view expenses.create expenses.approve
      ],
      "employee" => %w[
        employees.view
        attendance.view
        leave.view leave.create
        documents.view
        mail.view mail.search
      ]
    }.freeze

    def self.call(company)
      new(company).call
    end

    def initialize(company)
      @company = company
    end

    def call
      ActsAsTenant.with_tenant(@company) do
        DEFAULT_ROLE_PERMISSIONS.each do |slug, keys|
          role = @company.roles.create!(name: slug.titleize, slug: slug, system_default: true)
          role.permissions = (keys == :all ? Permission.all : Permission.where(key: keys))
        end
      end
    end
  end
end

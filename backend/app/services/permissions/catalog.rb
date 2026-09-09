module Permissions
  # Single source of truth for the global permission catalog — seeded into
  # the `permissions` table by db/seeds.rb, and referenced by
  # Roles::SeedDefaults when building each new company's default roles.
  # Covers what this pass actually gates (auth/company/RBAC bootstrapping)
  # plus the exact example keys the client spec names for modules that
  # arrive in later phases (HR §9, Accounts §10, Mail §7) — reserving the
  # key now is cheap metadata, not a build-ahead of the feature itself.
  module Catalog
    LIST = %w[
      employees.view employees.create employees.update employees.delete
      departments.view departments.create departments.update departments.delete
      designations.view designations.create designations.update designations.delete
      attendance.view attendance.manage
      leave.view leave.create leave.approve
      documents.view documents.create documents.delete
      payroll.view payroll.manage
      expenses.view expenses.create expenses.approve
      mail.view mail.search
      recruitment.view recruitment.manage
      candidates.view candidates.manage
      resumes.view resumes.process
      jobs.view jobs.manage
      roles.manage users.manage audit_logs.view zoho_connections.manage
    ].freeze

    def self.each_definition
      LIST.each do |key|
        resource, action = key.split(".", 2)
        yield key: key, resource: resource, action: action
      end
    end
  end
end

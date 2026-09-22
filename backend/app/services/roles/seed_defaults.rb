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
        employees.manage_roles employees.manage_reporting_managers
        departments.view departments.create departments.update departments.delete
        designations.view designations.create designations.update designations.delete
        attendance.view attendance.manage
        leave.view leave.create leave.approve
        documents.view documents.create documents.delete
        employee_history.view assets.manage
        goals.manage skills.manage training.manage pip.manage
        appraisal_feedback.manage
        appraisal_templates.view appraisal_templates.manage
        appraisal_cycles.view appraisal_cycles.manage
        appraisals.view_all appraisals.submit_self appraisals.review appraisals.release
        notifications.view
        recruitment.view recruitment.manage
        candidates.view candidates.manage
        resumes.view resumes.process
        jobs.view jobs.manage
        audit_logs.view
      ],
      "account" => %w[
        employees.view
        compensation.manage
        appraisals.submit_self appraisals.review
        notifications.view
        payroll.view payroll.manage
        expenses.view expenses.create expenses.approve
      ],
      # documents.view is scoped to the employee's own records by
      # DocumentPolicy::Scope, and documents.manage_own can only ever target
      # their own employee record — an employee never sees, uploads to, or
      # deletes anyone else's documents.
      "employee" => %w[
        employees.view
        attendance.view
        leave.view leave.create
        documents.view documents.manage_own
        mail.view mail.search
        appraisals.submit_self appraisals.review
        notifications.view
      ]
    }.freeze

    # `slug.titleize` rendered the HR role as "Hr". Harmless while role names
    # were never shown, but the Employee form's role picker puts them straight
    # in front of an HR admin — so display names are spelled out here.
    DISPLAY_NAMES = { "hr" => "HR" }.freeze

    def self.call(company)
      new(company).call
    end

    def initialize(company)
      @company = company
    end

    def call
      ActsAsTenant.with_tenant(@company) do
        DEFAULT_ROLE_PERMISSIONS.each do |slug, keys|
          role = @company.roles.create!(name: DISPLAY_NAMES.fetch(slug) { slug.titleize }, slug: slug, system_default: true)
          role.permissions = (keys == :all ? Permission.all : Permission.where(key: keys))
        end
      end
    end
  end
end

# Seeds the global permission catalog (app/services/permissions/catalog.rb).
# Idempotent — safe to re-run; new keys are added, nothing is removed
# automatically (a permission a role still references shouldn't vanish
# out from under it just because it was dropped from the catalog file).
Permissions::Catalog.each_definition do |key:, resource:, action:|
  Permission.find_or_create_by!(key: key) do |permission|
    permission.resource = resource
    permission.action = action
  end
end

puts "Seeded #{Permission.count} permissions."

# --- Demo data ------------------------------------------------------------
# A single demo company with one user per default role, a few departments/
# designations, and a handful of employee records — enough to look at a
# populated UI, not a real dataset. Guarded so re-running seeds doesn't
# duplicate it.
DEMO_SLUG = "acme-corporation".freeze
DEMO_PASSWORD = "Password123!".freeze

if Company.exists?(slug: DEMO_SLUG)
  puts "Demo company already seeded (#{DEMO_SLUG}) — skipping."
else
  company = Company.create!(name: "Acme Corporation", slug: DEMO_SLUG, timezone: "UTC")

  ActsAsTenant.with_tenant(company) do
    Roles::SeedDefaults.call(company)

    engineering = company.departments.create!(name: "Engineering", description: "Product & platform engineering")
    people_ops = company.departments.create!(name: "People Operations", description: "HR & talent")
    finance = company.departments.create!(name: "Finance", description: "Accounting & payroll")

    swe = company.designations.create!(title: "Software Engineer", department: engineering)
    eng_manager = company.designations.create!(title: "Engineering Manager", department: engineering)
    hr_manager = company.designations.create!(title: "HR Manager", department: people_ops)
    accountant = company.designations.create!(title: "Accountant", department: finance)

    demo_users = [
      { role: "admin", email: "admin@acme.test", first: "Ava", last: "Nolan", dept: nil, desig: nil, code: "ACM-001", level: :manager },
      { role: "hr", email: "hr@acme.test", first: "Priya", last: "Menon", dept: people_ops, desig: hr_manager, code: "ACM-002", level: :lead },
      { role: "account", email: "accounts@acme.test", first: "Marcus", last: "Lee", dept: finance, desig: accountant, code: "ACM-003", level: :senior },
      { role: "employee", email: "employee@acme.test", first: "Sofia", last: "Reyes", dept: engineering, desig: swe, code: "ACM-004", level: :junior }
    ]

    employees_by_code = {}

    demo_users.each do |u|
      user = company.users.create!(
        email_address: u[:email],
        password: DEMO_PASSWORD,
        first_name: u[:first],
        last_name: u[:last],
        status: :active,
        email_verified_at: Time.current
      )
      user.user_roles.create!(role: company.roles.find_by!(slug: u[:role]), company: company)
      employees_by_code[u[:code]] = company.employees.create!(
        user: user,
        employee_code: u[:code],
        first_name: u[:first],
        last_name: u[:last],
        department: u[:dept],
        designation: u[:desig],
        current_level: u[:level],
        date_of_joining: rand(30..900).days.ago.to_date,
        status: :active
      )
    end

    # A couple of employees with no login access at all, to show the model
    # (User and Employee are deliberately separate — not every employee
    # needs a system account).
    employees_by_code["ACM-005"] = company.employees.create!(
      employee_code: "ACM-005", first_name: "Daniel", last_name: "Osei",
      department: engineering, designation: eng_manager,
      current_level: :manager,
      date_of_joining: 400.days.ago.to_date, status: :active
    )
    employees_by_code["ACM-006"] = company.employees.create!(
      employee_code: "ACM-006", first_name: "Yuki", last_name: "Tanaka",
      department: people_ops, designation: hr_manager,
      current_level: :senior,
      date_of_joining: 60.days.ago.to_date, status: :active
    )

    # Reporting manager hierarchies:
    # Employee → Primary Manager → (optional) Secondary Manager → Final Manager.
    # ACM-004 gets all three slots (the cross-project case the Secondary slot
    # exists for); the other two get the ordinary Primary + Final pair.
    employees_by_code["ACM-004"].assign_managers!(
      "primary" => employees_by_code["ACM-005"].id,   # their Engineering Manager
      "secondary" => employees_by_code["ACM-006"].id, # shared/cross-project
      "final" => employees_by_code["ACM-001"].id      # the Admin, standing in for a CEO
    )
    employees_by_code["ACM-005"].assign_managers!(
      "primary" => employees_by_code["ACM-002"].id,
      "final" => employees_by_code["ACM-001"].id
    )
    employees_by_code["ACM-006"].assign_managers!(
      "primary" => employees_by_code["ACM-002"].id,
      "final" => employees_by_code["ACM-001"].id
    )
  end

  puts "Seeded demo company '#{company.name}' (#{company.slug})."
  puts "Demo logins (password for all: #{DEMO_PASSWORD}):"
  puts "  admin@acme.test     — Admin"
  puts "  hr@acme.test        — HR"
  puts "  accounts@acme.test  — Account"
  puts "  employee@acme.test  — Employee"
end

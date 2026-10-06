# Seeds, in two parts:
#
#   1. The permission catalog — always, everywhere. Required for the app to work.
#   2. A test company with five logins (Admin, HR, Accounts, Manager, Employee)
#      — only when SEED_* is filled in .env. Nothing about them is written here:
#      every email, the shared password and the company come from the
#      environment, so the same file is safe to run on any server.
#
#   bin/rails db:seed
#
# Idempotent. Re-running adds what is missing and never changes what exists:
# a user that is already there keeps its password, profile and roles.

# --- 1. Permissions ---------------------------------------------------------
# New keys are added; nothing is removed automatically (a permission a role
# still references shouldn't vanish because it was dropped from the catalog).
Permissions::Catalog.each_definition do |key:, resource:, action:|
  Permission.find_or_create_by!(key: key) do |permission|
    permission.resource = resource
    permission.action = action
  end
end
puts "Seeded #{Permission.count} permissions."

# --- 2. Test company and users ----------------------------------------------
env = ->(key) { ENV[key].to_s.strip.presence }

# Who to create. Each line needs its SEED_*_EMAIL; one left blank is skipped.
# `manager` is the employee-role login the others report to — the person who
# reviews appraisals at the first level.
SEED_USERS = [
  { key: "ADMIN",    role: "admin",    first: "Admin",    level: :manager },
  { key: "HR",       role: "hr",       first: "HR",       level: :lead },
  { key: "ACCOUNTS", role: "account",  first: "Accounts", level: :senior },
  { key: "MANAGER",  role: "employee", first: "Manager",  level: :manager },
  { key: "EMPLOYEE", role: "employee", first: "Employee", level: :junior }
].freeze

company_name = env.call("SEED_COMPANY_NAME")
password = env.call("SEED_PASSWORD")
people = SEED_USERS.filter_map { |u| (email = env.call("SEED_#{u[:key]}_EMAIL")) && u.merge(email: email.downcase) }

if company_name.nil? || password.nil? || people.empty?
  puts "Skipped test users: set SEED_COMPANY_NAME, SEED_PASSWORD and at least one SEED_*_EMAIL in .env " \
       "(see .env.example)."
  return
end
if password.length < User::MINIMUM_PASSWORD_LENGTH
  abort "SEED_PASSWORD must be at least #{User::MINIMUM_PASSWORD_LENGTH} characters."
end

company = Company.find_or_create_by!(slug: env.call("SEED_COMPANY_SLUG") || company_name.parameterize) do |c|
  c.name = company_name
  c.timezone = env.call("SEED_COMPANY_TIMEZONE") || "Kolkata" # a Rails zone name, e.g. Kolkata, London
end
# Employee codes follow the company's own starting code (Settings → Initial ID).
if company.employee_code_initial.blank?
  start = env.call("SEED_EMPLOYEE_CODE_START") or abort "Set SEED_EMPLOYEE_CODE_START in .env, e.g. BS-001."
  company.update!(employee_code_initial: start)
end

ActsAsTenant.with_tenant(company) do
  Roles::SeedDefaults.call(company)
  EmploymentType.seed_defaults(company)
  full_time = company.employment_types.find_by(name: "Full-time")

  created = []
  employees = {}

  people.each do |person|
    user = company.users.find_by(email_address: person[:email])
    if user.nil?
      user = company.users.create!(
        email_address: person[:email], password: password,
        first_name: person[:first], last_name: "User",
        status: :active, email_verified_at: Time.current
      )
      user.user_roles.find_or_create_by!(role: company.roles.find_by!(slug: person[:role]), company: company)
      created << person[:email]
    end

    employee = company.employees.find_by(user_id: user.id) ||
      company.employees.create!(
        user: user, employee_code: Employees::NextCode.call(company: company),
        first_name: user.first_name, last_name: user.last_name,
        current_level: person[:level], employment_type: full_time,
        date_of_joining: Date.current, status: :active
      )
    employees[person[:key]] = employee
  end

  # Reporting lines, so an appraisal cycle has a chain to walk: the Employee
  # reports to the Manager; everyone's final reviewer is the Admin. Only set
  # where nobody has assigned a manager yet.
  admin = employees["ADMIN"]
  {
    "HR" => employees["ADMIN"], "ACCOUNTS" => employees["ADMIN"],
    "MANAGER" => employees["ADMIN"], "EMPLOYEE" => employees["MANAGER"]
  }.each do |key, primary|
    employee = employees[key]
    next if employee.nil? || primary.nil? || employee.manager_hierarchy_complete?

    slots = { "primary" => primary.id }
    slots["final"] = admin.id if admin && admin != primary
    employee.assign_managers!(slots)
  end

  puts "Seeded test company '#{company.name}' (#{company.slug})."
  people.each do |person|
    status = created.include?(person[:email]) ? "created, password from SEED_PASSWORD" : "already existed — unchanged"
    puts format("  %-8s %-34s %s", person[:role], person[:email], status)
  end
end

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
# One demo company with ten employees, ACM-001 to ACM-010, each with a login
# and a filled-in profile — enough to exercise the directory, the reporting
# hierarchy and a full appraisal cycle against real-looking records.
#
# IDEMPOTENT PER RECORD, not all-or-nothing. This used to bail out entirely if
# the company already existed, which meant a developer who had already seeded
# could never pick up newly added demo people without dropping their database.
# Now each row is found-or-created, and — this is the important part — an
# existing row is only ever TOPPED UP:
#
#   * an existing User's email and password are never touched, so the admin
#     login you already use keeps working;
#   * an existing Employee keeps every field that already has a value, and
#     only its blanks are filled.
#
# So re-running adds what is missing and overwrites nothing.
DEMO_SLUG = "acme-corporation".freeze
DEMO_PASSWORD = "Password123!".freeze

company = Company.find_or_create_by!(slug: DEMO_SLUG) do |c|
  c.name = "Acme Corporation"
  c.timezone = "UTC"
end

ActsAsTenant.with_tenant(company) do
  Roles::SeedDefaults.call(company)

  departments = {
    engineering: [ "Engineering", "Product & platform engineering" ],
    people_ops: [ "People Operations", "HR & talent" ],
    finance: [ "Finance", "Accounting & payroll" ]
  }.transform_values do |(name, description)|
    company.departments.find_or_create_by!(name: name) { |d| d.description = description }
  end

  designations = {
    swe: [ "Software Engineer", :engineering ],
    senior_swe: [ "Senior Software Engineer", :engineering ],
    eng_manager: [ "Engineering Manager", :engineering ],
    hr_manager: [ "HR Manager", :people_ops ],
    hr_partner: [ "HR Business Partner", :people_ops ],
    accountant: [ "Accountant", :finance ],
    finance_lead: [ "Finance Lead", :finance ]
  }.transform_values do |(title, department_key)|
    company.designations.find_or_create_by!(title: title) { |d| d.department = departments[department_key] }
  end

  # The four e-mails at the top are the ones already in use — they are listed
  # here so the seed knows about them, NOT so it can rewrite them.
  demo_people = [
    { code: "ACM-001", email: "admin@acme.test", role: "admin", first: "Ava", last: "Nolan",
      dept: nil, desig: nil, level: :manager, type: :full_time, joined: 1_500,
      dob: "1984-03-12", gender: "Female", phone: "+91 98100 10001", location: "Gurugram HQ",
      city: "Gurugram", state: "Haryana", postal: "122002",
      kin: [ "Rohan Nolan", "+91 98100 90001" ] },
    { code: "ACM-002", email: "hr@acme.test", role: "hr", first: "Priya", last: "Menon",
      dept: :people_ops, desig: :hr_manager, level: :lead, type: :full_time, joined: 1_200,
      dob: "1988-07-24", gender: "Female", phone: "+91 98100 10002", location: "Gurugram HQ",
      city: "Gurugram", state: "Haryana", postal: "122002",
      kin: [ "Arun Menon", "+91 98100 90002" ] },
    { code: "ACM-003", email: "accounts@acme.test", role: "account", first: "Marcus", last: "Lee",
      dept: :finance, desig: :accountant, level: :senior, type: :full_time, joined: 900,
      dob: "1986-11-02", gender: "Male", phone: "+91 98100 10003", location: "Gurugram HQ",
      city: "Noida", state: "Uttar Pradesh", postal: "201301",
      kin: [ "Helen Lee", "+91 98100 90003" ] },
    { code: "ACM-004", email: "employee@acme.test", role: "employee", first: "Sofia", last: "Reyes",
      dept: :engineering, desig: :swe, level: :junior, type: :full_time, joined: 400,
      dob: "1997-05-18", gender: "Female", phone: "+91 98100 10004", location: "Remote — Pune",
      city: "Pune", state: "Maharashtra", postal: "411014",
      kin: [ "Elena Reyes", "+91 98100 90004" ] },
    { code: "ACM-005", email: "daniel.osei@acme.test", role: "employee", first: "Daniel", last: "Osei",
      dept: :engineering, desig: :eng_manager, level: :manager, type: :full_time, joined: 1_100,
      dob: "1983-09-30", gender: "Male", phone: "+91 98100 10005", location: "Gurugram HQ",
      city: "Gurugram", state: "Haryana", postal: "122018",
      kin: [ "Abena Osei", "+91 98100 90005" ] },
    { code: "ACM-006", email: "yuki.tanaka@acme.test", role: "hr", first: "Yuki", last: "Tanaka",
      dept: :people_ops, desig: :hr_partner, level: :senior, type: :full_time, joined: 600,
      dob: "1991-01-15", gender: "Female", phone: "+91 98100 10006", location: "Bengaluru",
      city: "Bengaluru", state: "Karnataka", postal: "560103",
      kin: [ "Haruto Tanaka", "+91 98100 90006" ] },
    { code: "ACM-007", email: "aarav.sharma@acme.test", role: "employee", first: "Aarav", last: "Sharma",
      dept: :engineering, desig: :senior_swe, level: :senior, type: :full_time, joined: 800,
      dob: "1990-06-08", gender: "Male", phone: "+91 98100 10007", location: "Gurugram HQ",
      city: "Delhi", state: "Delhi", postal: "110016",
      kin: [ "Kavita Sharma", "+91 98100 90007" ] },
    { code: "ACM-008", email: "elena.petrova@acme.test", role: "employee", first: "Elena", last: "Petrova",
      dept: :engineering, desig: :swe, level: :junior, type: :full_time, joined: 240,
      dob: "1996-12-21", gender: "Female", phone: "+91 98100 10008", location: "Remote — Goa",
      city: "Panaji", state: "Goa", postal: "403001",
      kin: [ "Mikhail Petrov", "+91 98100 90008" ] },
    { code: "ACM-009", email: "omar.haddad@acme.test", role: "employee", first: "Omar", last: "Haddad",
      dept: :engineering, desig: :swe, level: :intern, type: :intern, joined: 90,
      dob: "2002-04-05", gender: "Male", phone: "+91 98100 10009", location: "Remote — Hyderabad",
      city: "Hyderabad", state: "Telangana", postal: "500081",
      kin: [ "Layla Haddad", "+91 98100 90009" ] },
    { code: "ACM-010", email: "grace.miller@acme.test", role: "account", first: "Grace", last: "Miller",
      dept: :finance, desig: :finance_lead, level: :lead, type: :full_time, joined: 1_000,
      dob: "1985-08-19", gender: "Female", phone: "+91 98100 10010", location: "Gurugram HQ",
      city: "Gurugram", state: "Haryana", postal: "122001",
      kin: [ "Peter Miller", "+91 98100 90010" ] }
  ]

  # Assign only where the record has nothing yet. Anything a person (or an
  # earlier seed) already put there wins — this never overwrites.
  fill_blanks = lambda do |record, attributes|
    patch = attributes.reject { |name, _| record.read_attribute(name).present? }
    record.assign_attributes(patch) if patch.any?
    record
  end

  employees = {}
  created_users = []
  reused_users = []

  demo_people.each do |person|
    user = company.users.find_by(email_address: person[:email])
    if user.nil?
      user = company.users.create!(
        email_address: person[:email],
        password: DEMO_PASSWORD,
        first_name: person[:first],
        last_name: person[:last],
        status: :active,
        email_verified_at: Time.current
      )
      created_users << person[:email]
    else
      # Deliberately NOT touching email_address or password_digest: whatever
      # this login's password has been changed to is the password it keeps.
      reused_users << person[:email]
    end

    role = company.roles.find_by!(slug: person[:role])
    user.user_roles.find_or_create_by!(role: role, company: company)

    employee = company.employees.find_or_initialize_by(employee_code: person[:code])
    # first/last are NOT NULL, so a brand-new record needs them before the
    # blank-filling pass, which only ever touches empty columns.
    employee.first_name ||= person[:first]
    employee.last_name ||= person[:last]

    fill_blanks.call(employee, {
      user_id: user.id,
      department_id: person[:dept] && departments[person[:dept]].id,
      designation_id: person[:desig] && designations[person[:desig]].id,
      current_level: person[:level],
      employment_type: person[:type],
      date_of_joining: person[:joined].days.ago.to_date,
      date_of_birth: Date.parse(person[:dob]),
      gender: person[:gender],
      phone: person[:phone],
      personal_email: "#{person[:first].downcase}.#{person[:last].downcase}@example.com",
      work_location: person[:location],
      address_line1: "#{rand(1..99)} Sector #{rand(1..60)}",
      city: person[:city],
      state: person[:state],
      postal_code: person[:postal],
      country: "India",
      emergency_contact_name: person[:kin].first,
      emergency_contact_phone: person[:kin].last,
      status: :active
    })
    employee.save!
    employees[person[:code]] = employee
  end

  # Two employees with no login at all, kept because User and Employee are
  # deliberately separate models — not everyone on the payroll has an account,
  # and the UI has to cope with that. They moved out to ACM-011/012 when
  # ACM-005 and ACM-006 were given logins of their own.
  [
    { code: "ACM-011", first: "Ishaan", last: "Verma", dept: :engineering, desig: :swe, level: :junior, joined: 150 },
    { code: "ACM-012", first: "Meera", last: "Nair", dept: :people_ops, desig: :hr_partner, level: :senior, joined: 320 }
  ].each do |person|
    employee = company.employees.find_or_initialize_by(employee_code: person[:code])
    employee.first_name ||= person[:first]
    employee.last_name ||= person[:last]
    fill_blanks.call(employee, {
      department_id: departments[person[:dept]].id,
      designation_id: designations[person[:desig]].id,
      current_level: person[:level],
      employment_type: :full_time,
      date_of_joining: person[:joined].days.ago.to_date,
      work_location: "Gurugram HQ",
      status: :active
    })
    employee.save!
    employees[person[:code]] = employee
  end

  # Reporting hierarchy: Employee → Primary → (optional) Secondary → Final.
  # Deep enough that an appraisal cycle has real chains to walk — ACM-009's
  # final manager is ACM-005 rather than the Admin, so not every appraisal
  # funnels to the same person.
  {
    "ACM-002" => { "primary" => "ACM-001", "final" => "ACM-001" },
    "ACM-003" => { "primary" => "ACM-001", "final" => "ACM-001" },
    "ACM-004" => { "primary" => "ACM-005", "secondary" => "ACM-006", "final" => "ACM-001" },
    "ACM-005" => { "primary" => "ACM-002", "final" => "ACM-001" },
    "ACM-006" => { "primary" => "ACM-002", "final" => "ACM-001" },
    "ACM-007" => { "primary" => "ACM-005", "final" => "ACM-001" },
    "ACM-008" => { "primary" => "ACM-005", "secondary" => "ACM-007", "final" => "ACM-001" },
    "ACM-009" => { "primary" => "ACM-007", "final" => "ACM-005" },
    "ACM-010" => { "primary" => "ACM-003", "final" => "ACM-001" },
    "ACM-011" => { "primary" => "ACM-005", "final" => "ACM-001" },
    "ACM-012" => { "primary" => "ACM-002", "final" => "ACM-001" }
  }.each do |code, slots|
    employees[code].assign_managers!(slots.transform_values { |manager_code| employees[manager_code].id })
  end

  puts "Seeded demo company '#{company.name}' (#{company.slug})."
  puts "  #{created_users.size} login(s) created, #{reused_users.size} left exactly as they were."
  puts
  puts "Demo logins — password for NEWLY created accounts is #{DEMO_PASSWORD}"
  puts "(an account that already existed keeps whatever password it has now):"
  demo_people.each do |person|
    note = created_users.include?(person[:email]) ? "new" : "existing"
    puts format("  %-8s %-26s %-9s %-16s (%s)",
                person[:code], person[:email], person[:role], "#{person[:first]} #{person[:last]}", note)
  end
  puts "  ACM-011  (no login)               —         Ishaan Verma"
  puts "  ACM-012  (no login)               —         Meera Nair"
end

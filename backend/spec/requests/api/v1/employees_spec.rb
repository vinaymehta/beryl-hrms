require "rails_helper"

RSpec.describe "Api::V1::Employees", type: :request do
  # Registering builds the company with its 4 seeded default roles and signs
  # the caller in as Admin, so every role/permission below is the real seeded
  # one rather than a hand-built approximation.
  before do
    post "/api/v1/auth/register",
         params: {
           companyName: "People Corp",
           firstName: "Ada",
           lastName: "Admin",
           email: "people.admin@acme.test",
           password: "correct-horse-battery-1",
           passwordConfirmation: "correct-horse-battery-1"
         }.to_json,
         headers: { "Content-Type" => "application/json" }
  end

  let(:company) { Company.find_by!(name: "People Corp") }
  let(:json_headers) { { "Content-Type" => "application/json" } }

  def role(slug) = ActsAsTenant.with_tenant(company) { company.roles.find_by!(slug: slug) }
  def in_tenant(&) = ActsAsTenant.with_tenant(company, &)

  def create_employee(**attrs)
    post "/api/v1/employees", params: attrs.to_json, headers: json_headers
  end

  def body_hierarchy = response.parsed_body.dig("data", "managerHierarchy")

  def employee_for(email)
    in_tenant { company.employees.find_by!(user_id: company.users.find_by!(email_address: email).id) }
  end

  def sign_in_as(email:, role_slug:, with_employee_record: true)
    in_tenant do
      user = create(:user, company: company, email_address: email, password: "correct-horse-battery-1")
      create(:user_role, user: user, role: role(role_slug), company: company)
      create(:employee, company: company, user: user) if with_employee_record
    end

    post "/api/v1/auth/login",
         params: { email: email, password: "correct-horse-battery-1" }.to_json,
         headers: json_headers
  end

  describe "POST /api/v1/employees" do
    it "records the career level alongside the designation" do
      designation = in_tenant { company.designations.create!(title: "Software Engineer") }

      create_employee(
        employeeCode: "PC-100", firstName: "Nora", lastName: "Reed",
        designationId: designation.id, currentLevel: "senior"
      )

      expect(response).to have_http_status(:created)
      body = response.parsed_body["data"]
      expect(body["currentLevel"]).to eq("senior")
      expect(body.dig("designation", "title")).to eq("Software Engineer")
    end

    it "rejects a level that isn't on the ladder" do
      create_employee(employeeCode: "PC-101", firstName: "Nora", lastName: "Reed", currentLevel: "principal")

      expect(response).to have_http_status(:unprocessable_content)
    end

    it "gives a newly provisioned account the Employee role by default" do
      expect {
        create_employee(employeeCode: "PC-102", firstName: "Iris", lastName: "Vale", workEmail: "iris@acme.test")
      }.to change { in_tenant { company.users.count } }.by(1)

      expect(response).to have_http_status(:created)
      expect(response.parsed_body["data"]["roles"].map { |r| r["slug"] }).to eq([ "employee" ])
    end

    it "adds HR on top of the default Employee role when asked" do
      create_employee(
        employeeCode: "PC-103", firstName: "Hal", lastName: "Brand",
        workEmail: "hal@acme.test", roleIds: [ role("hr").id ]
      )

      expect(response).to have_http_status(:created)
      expect(response.parsed_body["data"]["roles"].map { |r| r["slug"] }).to match_array(%w[employee hr])
    end

    it "creates the login with no usable password and does not invite yet" do
      # Creating the record and inviting the person are two separate actions:
      # HR sets a joiner up ahead of their start date, so no mail goes out
      # until Admin presses Invite.
      expect {
        create_employee(employeeCode: "PC-104", firstName: "Sam", lastName: "Okoye", workEmail: "sam@acme.test")
      }.not_to have_enqueued_mail(UserMailer, :invitation)

      user = in_tenant { company.users.find_by!(email_address: "sam@acme.test") }
      # `invited`, not `active`: the account exists but nobody — not the
      # creator, not the API response — holds a password for it.
      expect(user).to be_invited
      expect(user.invited_at).to be_nil
      expect(response.parsed_body["data"]["user"]).to include(
        "status" => "invited", "invitationUnsent" => true, "invitationPending" => false
      )
      expect(response.parsed_body["data"]["user"].keys)
        .to match_array(%w[id email status emailVerifiedAt lastLoginAt
                           invitedAt invitationAcceptedAt invitationPending invitationUnsent
                           mustChangePassword])
    end

    it "links an existing account rather than creating a second one" do
      existing = in_tenant { create(:user, company: company, email_address: "already@acme.test") }

      expect {
        create_employee(employeeCode: "PC-105", firstName: "Ren", lastName: "Amari", workEmail: "already@acme.test")
      }.not_to change { in_tenant { company.users.count } }

      expect(response.parsed_body["data"].dig("user", "id")).to eq(existing.id)
    end

    it "refuses roles with no email to hang an account on" do
      create_employee(employeeCode: "PC-106", firstName: "No", lastName: "Email", roleIds: [ role("hr").id ])

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["errors"].first["message"]).to match(/work email is required/i)
      expect(in_tenant { company.employees.find_by(employee_code: "PC-106") }).to be_nil
    end
  end

  describe "PATCH /api/v1/employees/:id" do
    it "refuses to move an existing login to a different address" do
      create_employee(employeeCode: "PC-110", firstName: "Zed", lastName: "Amari", workEmail: "zed@acme.test")
      id = response.parsed_body.dig("data", "id")

      patch "/api/v1/employees/#{id}",
            params: { workEmail: "someone.else@acme.test" }.to_json, headers: json_headers

      expect(response).to have_http_status(:unprocessable_content)
      expect(in_tenant { company.users.find_by(email_address: "zed@acme.test") }).to be_present
    end

    it "accepts the unchanged address alongside a role change" do
      create_employee(employeeCode: "PC-111", firstName: "Ivy", lastName: "Cole", workEmail: "ivy@acme.test")
      id = response.parsed_body.dig("data", "id")

      patch "/api/v1/employees/#{id}",
            params: { workEmail: "ivy@acme.test", roleIds: [ role("admin").id ] }.to_json, headers: json_headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["data"]["roles"].map { |r| r["slug"] }).to match_array(%w[admin employee])
    end
  end

  describe "reporting manager hierarchy" do
    it "assigns all three typed slots on create" do
      primary = in_tenant { create(:employee, company: company, first_name: "Mia", last_name: "Stone") }
      secondary = in_tenant { create(:employee, company: company, first_name: "Leo", last_name: "Park") }
      final = in_tenant { create(:employee, company: company, first_name: "Ada", last_name: "Vance") }

      create_employee(
        employeeCode: "PC-200", firstName: "Dana", lastName: "Fox",
        primaryManagerId: primary.id, secondaryManagerId: secondary.id, finalManagerId: final.id
      )

      expect(response).to have_http_status(:created)
      hierarchy = response.parsed_body["data"]["managerHierarchy"]
      expect(hierarchy["primary"]["fullName"]).to eq("Mia Stone")
      expect(hierarchy["secondary"]["fullName"]).to eq("Leo Park")
      expect(hierarchy["final"]["fullName"]).to eq("Ada Vance")
      expect(response.parsed_body["data"]["managerHierarchyComplete"]).to be(true)
    end

    it "treats the secondary manager as optional" do
      primary = in_tenant { create(:employee, company: company) }
      final = in_tenant { create(:employee, company: company) }

      create_employee(
        employeeCode: "PC-201", firstName: "Rae", lastName: "Lin",
        primaryManagerId: primary.id, finalManagerId: final.id
      )

      expect(response).to have_http_status(:created)
      expect(response.parsed_body["data"]["managerHierarchy"]["secondary"]).to be_nil
      expect(response.parsed_body["data"]["managerHierarchyComplete"]).to be(true)
    end

    it "caps each level at one person by replacing the slot" do
      first = in_tenant { create(:employee, company: company, first_name: "One", last_name: "Alpha") }
      second = in_tenant { create(:employee, company: company, first_name: "Two", last_name: "Beta") }
      employee = in_tenant { create(:employee, company: company) }

      patch "/api/v1/employees/#{employee.id}",
            params: { primaryManagerId: first.id }.to_json, headers: json_headers
      patch "/api/v1/employees/#{employee.id}",
            params: { primaryManagerId: second.id }.to_json, headers: json_headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["data"]["managerHierarchy"]["primary"]["fullName"]).to eq("Two Beta")
      expect(in_tenant { employee.reload.manager_assignments.count }).to eq(1)
    end

    it "leaves a slot alone when the request doesn't mention it" do
      primary = in_tenant { create(:employee, company: company) }
      final = in_tenant { create(:employee, company: company) }
      employee = in_tenant { create(:employee, company: company) }
      in_tenant { employee.assign_managers!("primary" => primary.id, "final" => final.id) }

      patch "/api/v1/employees/#{employee.id}",
            params: { phone: "555-0100" }.to_json, headers: json_headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["data"]["managerHierarchy"]["primary"]["id"]).to eq(primary.id)
      expect(response.parsed_body["data"]["managerHierarchy"]["final"]["id"]).to eq(final.id)
    end

    it "clears a slot when it is sent as null" do
      primary = in_tenant { create(:employee, company: company) }
      secondary = in_tenant { create(:employee, company: company) }
      employee = in_tenant { create(:employee, company: company) }
      in_tenant { employee.assign_managers!("primary" => primary.id, "secondary" => secondary.id) }

      patch "/api/v1/employees/#{employee.id}",
            params: { secondaryManagerId: nil }.to_json, headers: json_headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["data"]["managerHierarchy"]["secondary"]).to be_nil
      expect(response.parsed_body["data"]["managerHierarchy"]["primary"]).to be_present
    end

    it "removes secondary reviewer and deletes the employee_manager relationship" do
      primary = in_tenant { create(:employee, company: company) }
      secondary = in_tenant { create(:employee, company: company) }
      final = in_tenant { create(:employee, company: company) }
      employee = in_tenant { create(:employee, company: company) }
      in_tenant { employee.assign_managers!("primary" => primary.id, "secondary" => secondary.id, "final" => final.id) }

      expect(in_tenant { employee.secondary_manager }).to eq(secondary)

      patch "/api/v1/employees/#{employee.id}",
            params: { secondaryManagerId: nil }.to_json, headers: json_headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["data"]["managerHierarchy"]["secondary"]).to be_nil
      expect(in_tenant { employee.reload.secondary_manager }).to be_nil
      expect(in_tenant { employee.manager_assignments.where(manager_level: :secondary) }).to be_empty
    end

    it "removes final reviewer and marks hierarchy incomplete without corrupting data" do
      primary = in_tenant { create(:employee, company: company) }
      final = in_tenant { create(:employee, company: company) }
      employee = in_tenant { create(:employee, company: company) }
      in_tenant { employee.assign_managers!("primary" => primary.id, "final" => final.id) }

      expect(in_tenant { employee.manager_hierarchy_complete? }).to be(true)

      patch "/api/v1/employees/#{employee.id}",
            params: { finalManagerId: nil }.to_json, headers: json_headers

      expect(response).to have_http_status(:ok)
      data = response.parsed_body["data"]
      expect(data["managerHierarchy"]["final"]).to be_nil
      expect(data["managerHierarchyComplete"]).to be(false)
      expect(in_tenant { employee.reload.final_manager }).to be_nil
      expect(in_tenant { employee.reload.manager_hierarchy_complete? }).to be(false)
      expect(in_tenant { employee.primary_manager }).to eq(primary)
    end

    it "refuses a secondary manager with no primary" do
      secondary = in_tenant { create(:employee, company: company) }
      employee = in_tenant { create(:employee, company: company) }

      patch "/api/v1/employees/#{employee.id}",
            params: { secondaryManagerId: secondary.id }.to_json, headers: json_headers

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["errors"].first["message"]).to match(/primary manager is required/i)
      expect(in_tenant { employee.reload.manager_assignments.to_a }).to be_empty
    end

    it "refuses a final manager with no primary" do
      final = in_tenant { create(:employee, company: company) }
      employee = in_tenant { create(:employee, company: company) }

      patch "/api/v1/employees/#{employee.id}",
            params: { finalManagerId: final.id }.to_json, headers: json_headers

      expect(response).to have_http_status(:unprocessable_content)
      expect(in_tenant { employee.reload.manager_assignments.to_a }).to be_empty
    end

    it "refuses an employee as their own manager" do
      employee = in_tenant { create(:employee, company: company) }

      patch "/api/v1/employees/#{employee.id}",
            params: { primaryManagerId: employee.id }.to_json, headers: json_headers

      expect(response).to have_http_status(:unprocessable_content)
    end

    it "refuses a manager from another company" do
      outsider = create(:company)
      foreign = ActsAsTenant.with_tenant(outsider) { create(:employee, company: outsider) }
      employee = in_tenant { create(:employee, company: company) }

      patch "/api/v1/employees/#{employee.id}",
            params: { primaryManagerId: foreign.id }.to_json, headers: json_headers

      expect(response).to have_http_status(:unprocessable_content)
      expect(in_tenant { employee.reload.manager_assignments.to_a }).to be_empty
    end

    it "refuses an inactive employee as a new manager" do
      inactive = in_tenant { create(:employee, company: company, status: :inactive) }
      employee = in_tenant { create(:employee, company: company) }

      patch "/api/v1/employees/#{employee.id}",
            params: { primaryManagerId: inactive.id }.to_json, headers: json_headers

      expect(response).to have_http_status(:unprocessable_content)
    end

    it "lets an employee READ their own manager hierarchy" do
      manager = in_tenant { create(:employee, company: company, first_name: "Vik", last_name: "Rao") }
      boss = in_tenant { create(:employee, company: company, first_name: "Ceo", last_name: "Prime") }
      sign_in_as(email: "staff@acme.test", role_slug: "employee")
      own = employee_for("staff@acme.test")
      in_tenant { own.assign_managers!("primary" => manager.id, "final" => boss.id) }

      get "/api/v1/employees/#{own.id}"

      expect(response).to have_http_status(:ok)
      hierarchy = response.parsed_body["data"]["managerHierarchy"]
      expect(hierarchy["primary"]["fullName"]).to eq("Vik Rao")
      expect(hierarchy["final"]["fullName"]).to eq("Ceo Prime")
    end

    it "does not let an employee change their own managers" do
      manager = in_tenant { create(:employee, company: company) }
      sign_in_as(email: "staff2@acme.test", role_slug: "employee")
      own = employee_for("staff2@acme.test")

      patch "/api/v1/employees/#{own.id}",
            params: { primaryManagerId: manager.id }.to_json, headers: json_headers

      expect(response).to have_http_status(:forbidden)
      expect(in_tenant { own.reload.manager_assignments.to_a }).to be_empty
    end

    it "does not turn a manager into an administrator" do
      sign_in_as(email: "staff3@acme.test", role_slug: "employee")
      manager_employee = employee_for("staff3@acme.test")
      report = in_tenant { create(:employee, company: company) }
      in_tenant { report.assign_managers!("primary" => manager_employee.id) }

      # Being someone's Primary Manager is an assignment, not a system role: it
      # confers no product permission whatsoever. 404 rather than 403 because
      # EmployeePolicy::Scope still shows a plain employee only their OWN
      # record — a manager assignment doesn't even widen what they can see.
      patch "/api/v1/employees/#{report.id}",
            params: { firstName: "Renamed" }.to_json, headers: json_headers

      expect(response).to have_http_status(:not_found)
      expect(in_tenant { report.reload.first_name }).not_to eq("Renamed")
    end
  end

  describe "project managers (§4) — the one plural slot" do
    it "accepts a single project manager" do
      pm = in_tenant { create(:employee, company: company, first_name: "Pam", last_name: "Project") }
      employee = in_tenant { create(:employee, company: company) }

      patch "/api/v1/employees/#{employee.id}",
            params: { projectManagerIds: [ pm.id ] }.to_json, headers: json_headers

      expect(response).to have_http_status(:ok)
      expect(body_hierarchy["projectManagers"].map { |m| m["fullName"] }).to eq([ "Pam Project" ])
    end

    it "accepts SEVERAL project managers at once" do
      one = in_tenant { create(:employee, company: company, first_name: "One", last_name: "Pm") }
      two = in_tenant { create(:employee, company: company, first_name: "Two", last_name: "Pm") }
      three = in_tenant { create(:employee, company: company, first_name: "Three", last_name: "Pm") }
      employee = in_tenant { create(:employee, company: company) }

      patch "/api/v1/employees/#{employee.id}",
            params: { projectManagerIds: [ one.id, two.id, three.id ] }.to_json, headers: json_headers

      expect(response).to have_http_status(:ok)
      expect(body_hierarchy["projectManagers"].map { |m| m["fullName"] })
        .to match_array([ "One Pm", "Two Pm", "Three Pm" ])
      expect(in_tenant { employee.reload.project_manager_ids.size }).to eq(3)
    end

    it "syncs the set rather than appending to it" do
      one = in_tenant { create(:employee, company: company) }
      two = in_tenant { create(:employee, company: company) }
      employee = in_tenant { create(:employee, company: company) }
      in_tenant { employee.assign_managers!("project_manager" => [ one.id, two.id ]) }

      patch "/api/v1/employees/#{employee.id}",
            params: { projectManagerIds: [ two.id ] }.to_json, headers: json_headers

      expect(body_hierarchy["projectManagers"].map { |m| m["id"] }).to eq([ two.id ])
    end

    it "clears them when sent an empty array" do
      pm = in_tenant { create(:employee, company: company) }
      employee = in_tenant { create(:employee, company: company) }
      in_tenant { employee.assign_managers!("project_manager" => [ pm.id ]) }

      patch "/api/v1/employees/#{employee.id}",
            params: { projectManagerIds: [] }.to_json, headers: json_headers

      expect(body_hierarchy["projectManagers"]).to be_empty
    end

    it "does not need a primary manager first — it sits outside the review chain" do
      pm = in_tenant { create(:employee, company: company) }
      employee = in_tenant { create(:employee, company: company) }

      patch "/api/v1/employees/#{employee.id}",
            params: { projectManagerIds: [ pm.id ] }.to_json, headers: json_headers

      expect(response).to have_http_status(:ok)
      expect(body_hierarchy["primary"]).to be_nil
    end

    it "keeps the same person from being added twice" do
      pm = in_tenant { create(:employee, company: company) }
      employee = in_tenant { create(:employee, company: company) }

      patch "/api/v1/employees/#{employee.id}",
            params: { projectManagerIds: [ pm.id, pm.id ] }.to_json, headers: json_headers

      expect(response).to have_http_status(:ok)
      expect(body_hierarchy["projectManagers"].size).to eq(1)
    end

    it "still refuses self, another company, and an inactive employee" do
      employee = in_tenant { create(:employee, company: company) }
      inactive = in_tenant { create(:employee, company: company, status: :inactive) }
      outsider = create(:company)
      foreign = ActsAsTenant.with_tenant(outsider) { create(:employee, company: outsider) }

      [ employee.id, inactive.id, foreign.id ].each do |bad_id|
        patch "/api/v1/employees/#{employee.id}",
              params: { projectManagerIds: [ bad_id ] }.to_json, headers: json_headers
        expect(response).to have_http_status(:unprocessable_content)
      end
      expect(in_tenant { employee.reload.project_manager_ids }).to be_empty
    end
  end

  describe "department head (§4) — separate from the final reviewer" do
    it "is its own relationship, held by a different person" do
      head = in_tenant { create(:employee, company: company, first_name: "Dana", last_name: "Head") }
      final = in_tenant { create(:employee, company: company, first_name: "Fin", last_name: "Final") }
      primary = in_tenant { create(:employee, company: company) }
      employee = in_tenant { create(:employee, company: company) }

      patch "/api/v1/employees/#{employee.id}",
            params: { primaryManagerId: primary.id, finalManagerId: final.id,
                      departmentHeadId: head.id }.to_json, headers: json_headers

      expect(response).to have_http_status(:ok)
      hierarchy = body_hierarchy
      expect(hierarchy["departmentHead"]["fullName"]).to eq("Dana Head")
      expect(hierarchy["final"]["fullName"]).to eq("Fin Final")
      expect(hierarchy["departmentHead"]["id"]).not_to eq(hierarchy["final"]["id"])
    end

    it "is NOT inferred from the final reviewer when only the final is set" do
      final = in_tenant { create(:employee, company: company) }
      primary = in_tenant { create(:employee, company: company) }
      employee = in_tenant { create(:employee, company: company) }

      patch "/api/v1/employees/#{employee.id}",
            params: { primaryManagerId: primary.id, finalManagerId: final.id }.to_json,
            headers: json_headers

      expect(body_hierarchy["departmentHead"]).to be_nil
    end

    it "can be set with no review chain at all" do
      head = in_tenant { create(:employee, company: company) }
      employee = in_tenant { create(:employee, company: company) }

      patch "/api/v1/employees/#{employee.id}",
            params: { departmentHeadId: head.id }.to_json, headers: json_headers

      expect(response).to have_http_status(:ok)
      expect(body_hierarchy["departmentHead"]["id"]).to eq(head.id)
    end

    it "holds at most one person" do
      first = in_tenant { create(:employee, company: company, first_name: "First", last_name: "Head") }
      second = in_tenant { create(:employee, company: company, first_name: "Second", last_name: "Head") }
      employee = in_tenant { create(:employee, company: company) }

      patch "/api/v1/employees/#{employee.id}",
            params: { departmentHeadId: first.id }.to_json, headers: json_headers
      patch "/api/v1/employees/#{employee.id}",
            params: { departmentHeadId: second.id }.to_json, headers: json_headers

      expect(body_hierarchy["departmentHead"]["fullName"]).to eq("Second Head")
      expect(in_tenant { employee.reload.manager_assignments.where(manager_level: :department_head).count }).to eq(1)
    end
  end

  describe "the five slots stay independent" do
    it "keeps project managers and the department head out of the review chain" do
      primary = in_tenant { create(:employee, company: company, first_name: "Pri", last_name: "Mary") }
      final = in_tenant { create(:employee, company: company, first_name: "Fin", last_name: "Al") }
      head = in_tenant { create(:employee, company: company, first_name: "Dept", last_name: "Head") }
      pm = in_tenant { create(:employee, company: company, first_name: "Proj", last_name: "Mgr") }
      employee = in_tenant { create(:employee, company: company) }

      patch "/api/v1/employees/#{employee.id}",
            params: { primaryManagerId: primary.id, finalManagerId: final.id,
                      departmentHeadId: head.id, projectManagerIds: [ pm.id ] }.to_json,
            headers: json_headers

      hierarchy = body_hierarchy
      names = {
        primary: hierarchy["primary"]["fullName"],
        final: hierarchy["final"]["fullName"],
        head: hierarchy["departmentHead"]["fullName"],
        pm: hierarchy["projectManagers"].first["fullName"]
      }
      # Four slots, four different people, none standing in for another.
      expect(names.values.uniq.size).to eq(4)
      expect(hierarchy["managerHierarchyComplete"]).to be_nil # lives on the employee, not the hierarchy
      expect(response.parsed_body["data"]["managerHierarchyComplete"]).to be(true)
    end

    it "leaves an untouched slot alone" do
      pm = in_tenant { create(:employee, company: company) }
      head = in_tenant { create(:employee, company: company) }
      employee = in_tenant { create(:employee, company: company) }
      in_tenant { employee.assign_managers!("project_manager" => [ pm.id ], "department_head" => head.id) }

      patch "/api/v1/employees/#{employee.id}",
            params: { phone: "555-0100" }.to_json, headers: json_headers

      expect(body_hierarchy["projectManagers"].size).to eq(1)
      expect(body_hierarchy["departmentHead"]).to be_present
    end
  end

  describe "HR parity" do
    it "lets HR do everything Admin can on the employee record" do
      sign_in_as(email: "hr@acme.test", role_slug: "hr")
      lead = in_tenant { create(:employee, company: company, first_name: "Gil", last_name: "Amos") }
      head = in_tenant { create(:employee, company: company, first_name: "Nia", last_name: "Roy") }

      create_employee(
        employeeCode: "PC-300", firstName: "Tess", lastName: "Kaur",
        currentLevel: "lead", workEmail: "tess@acme.test",
        roleIds: [ role("admin").id ], primaryManagerId: lead.id, finalManagerId: head.id
      )

      expect(response).to have_http_status(:created)
      body = response.parsed_body["data"]
      expect(body["currentLevel"]).to eq("lead")
      expect(body["roles"].map { |r| r["slug"] }).to match_array(%w[admin employee])
      expect(body["managerHierarchy"]["primary"]["fullName"]).to eq("Gil Amos")
      expect(body["managerHierarchy"]["final"]["fullName"]).to eq("Nia Roy")
    end
  end

  describe "GET /api/v1/roles" do
    it "lists the company's roles for the picker" do
      get "/api/v1/roles"

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["data"].map { |r| r["slug"] }).to match_array(%w[admin hr account employee])
    end

    it "is closed to a plain employee" do
      sign_in_as(email: "nobody@acme.test", role_slug: "employee")

      get "/api/v1/roles"

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "Employee role directory scoping" do
    it "restricts employee role to viewing only their own record in index" do
      in_tenant { create_list(:employee, 3, company: company) }
      sign_in_as(email: "directory_staff@acme.test", role_slug: "employee")
      own = employee_for("directory_staff@acme.test")

      get "/api/v1/employees"

      expect(response).to have_http_status(:ok)
      records = response.parsed_body["data"]
      expect(records.size).to eq(1)
      expect(records.first["id"]).to eq(own.id)
    end
  end
end

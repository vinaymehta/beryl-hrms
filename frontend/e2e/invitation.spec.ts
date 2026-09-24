import { test, expect, type Page } from "@playwright/test"

/**
 * Admin → Create Employee → Invite → link → Employee sets their own password →
 * Employee logs in, and the Admin-triggered reset that follows the same shape.
 *
 * Mocked at the API boundary, like the other specs here, and written to the
 * contract the Rails side actually implements (see
 * spec/requests/api/v1/employee_invitation_spec.rb, which exercises the same
 * flow against the real database and the real delivered email). What this adds
 * is the half the request specs can't see: that the buttons exist, that the
 * confirmation stands between the admin and somebody's inbox, and that no
 * screen in the flow ever offers an administrator a password field.
 */

const ADMIN_ME = {
  user: {
    id: "admin-1",
    firstName: "Ada",
    lastName: "Admin",
    email: "ada@acme.test",
    emailVerifiedAt: new Date().toISOString(),
    status: "active",
  },
  company: { id: "c1", name: "Acme Inc.", slug: "acme-inc" },
  roles: [{ id: "r1", name: "Admin", slug: "admin" }],
  permissions: [
    "employees.view",
    "employees.create",
    "employees.update",
    "employees.delete",
    "employees.manage_roles",
  ],
}

const EMPLOYEE_ME = {
  user: {
    id: "u-noor",
    firstName: "Noor",
    lastName: "Haddad",
    email: "noor@acme.test",
    emailVerifiedAt: new Date().toISOString(),
    status: "active",
    employeeRecord: { id: "emp-1" },
  },
  company: { id: "c1", name: "Acme Inc.", slug: "acme-inc" },
  roles: [{ id: "r2", name: "Employee", slug: "employee" }],
  permissions: ["employees.view", "notifications.view"],
}

type AccountState = "unsent" | "pending" | "active"

function employeeRecord(state: AccountState) {
  return {
    id: "emp-1",
    companyId: "c1",
    employeeCode: "EMP-001",
    firstName: "Noor",
    lastName: "Haddad",
    fullName: "Noor Haddad",
    status: "active",
    roles: [{ id: "r2", name: "Employee", slug: "employee" }],
    department: null,
    designation: null,
    currentLevel: null,
    dateOfJoining: "2026-09-01",
    managerHierarchy: {
      primary: null,
      secondary: null,
      final: null,
      departmentHead: null,
      projectManagers: [],
    },
    managerHierarchyComplete: false,
    user: {
      id: "u-noor",
      email: "noor@acme.test",
      status: state === "active" ? "active" : "invited",
      emailVerifiedAt: state === "active" ? "2026-09-21T10:00:00Z" : null,
      lastLoginAt: null,
      invitedAt: state === "unsent" ? null : "2026-09-20T09:00:00Z",
      invitationAcceptedAt: state === "active" ? "2026-09-21T10:00:00Z" : null,
      invitationPending: state === "pending",
      invitationUnsent: state === "unsent",
    },
  }
}

/** The admin's view of one employee, with the account in a given state. */
async function asAdminViewing(page: Page, state: AccountState) {
  await page.route("**/api/v1/auth/me", (route) => route.fulfill({ json: { data: ADMIN_ME } }))
  await page.route("**/api/v1/employees/emp-1", (route) =>
    route.fulfill({ json: { data: employeeRecord(state) } })
  )
  await page.route("**/api/v1/employees/emp-1/documents**", (route) =>
    route.fulfill({ json: { data: [] } })
  )
  await page.route("**/api/v1/employees/emp-1/**", (route) => route.fulfill({ json: { data: [] } }))
}

test.describe("Admin invites an employee", () => {
  test("sends the invitation from the employee's record", async ({ page }) => {
    await asAdminViewing(page, "unsent")

    let invited = false
    await page.route("**/api/v1/employees/emp-1/invite", async (route) => {
      invited = true
      await route.fulfill({
        json: {
          data: {
            message: "Invitation sent to noor@acme.test.",
            employee: employeeRecord("pending"),
          },
        },
      })
    })

    await page.goto("/employees/emp-1")

    await expect(page.getByText("Not invited")).toBeVisible()
    await page.getByRole("button", { name: /send invitation/i }).click()

    await expect(page.getByText("Invitation sent to noor@acme.test.")).toBeVisible()
    expect(invited).toBe(true)
  })

  test("offers the admin no way to see or set the password", async ({ page }) => {
    await asAdminViewing(page, "active")
    await page.goto("/employees/emp-1")

    await expect(page.getByText(/can't see or set someone else's password/i)).toBeVisible()
    // Not one password field anywhere on the record.
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
  })

  test("asks before emailing a reset to somebody", async ({ page }) => {
    await asAdminViewing(page, "active")

    let sent = false
    await page.route("**/api/v1/employees/emp-1/reset_password", async (route) => {
      sent = true
      await route.fulfill({
        json: {
          data: {
            message: "Password reset link sent to noor@acme.test.",
            employee: employeeRecord("active"),
          },
        },
      })
    })

    await page.goto("/employees/emp-1")
    await page.getByRole("button", { name: /send password reset/i }).click()

    // The dialog stands between the click and the inbox.
    await expect(page.getByText(/send a password reset\?/i)).toBeVisible()
    expect(sent).toBe(false)

    await page.getByRole("button", { name: /send reset link/i }).click()
    await expect(page.getByText("Password reset link sent to noor@acme.test.")).toBeVisible()
    expect(sent).toBe(true)
  })
})

test.describe("The employee opens their invitation", () => {
  const INVITATION = {
    email: "noor@acme.test",
    firstName: "Noor",
    lastName: "Haddad",
    companyName: "Acme Inc.",
  }

  test("sets their own password and lands signed in", async ({ page }) => {
    let signedIn = false
    let submitted: Record<string, unknown> | null = null

    await page.route("**/api/v1/auth/me", (route) =>
      signedIn
        ? route.fulfill({ json: { data: EMPLOYEE_ME } })
        : route.fulfill({
            status: 401,
            json: { errors: [{ code: "unauthenticated", message: "Not signed in" }] },
          })
    )
    await page.route("**/api/v1/auth/invitation**", (route) =>
      route.fulfill({ json: { data: INVITATION } })
    )
    await page.route("**/api/v1/auth/accept_invitation", async (route) => {
      submitted = route.request().postDataJSON()
      signedIn = true
      await route.fulfill({ status: 201, json: { data: EMPLOYEE_ME } })
    })
    await page.route("**/api/v1/employees/emp-1", (route) =>
      route.fulfill({ json: { data: employeeRecord("active") } })
    )
    await page.route("**/api/v1/dashboard/**", (route) => route.fulfill({ json: { data: {} } }))

    await page.goto("/accept-invitation?token=good-token")

    await expect(page.getByText("Welcome, Noor")).toBeVisible()
    await expect(page.getByText(/noor@acme\.test/)).toBeVisible()

    // Both fields carry the reveal toggle, and revealing doesn't disturb them.
    const created = page.getByLabel("Create password")
    await created.fill("employee-chosen-1")
    await page.getByRole("button", { name: "Show password" }).first().click()
    await expect(created).toHaveValue("employee-chosen-1")

    await page.getByLabel("Confirm password").fill("employee-chosen-1")
    await page.getByRole("button", { name: /set password and sign in/i }).click()

    await expect(page).not.toHaveURL(/accept-invitation/)
    expect(submitted).toMatchObject({
      token: "good-token",
      password: "employee-chosen-1",
      passwordConfirmation: "employee-chosen-1",
    })
  })

  test("is told plainly when the link is spent, before typing anything", async ({ page }) => {
    await page.route("**/api/v1/auth/me", (route) =>
      route.fulfill({
        status: 401,
        json: { errors: [{ code: "unauthenticated", message: "Not signed in" }] },
      })
    )
    await page.route("**/api/v1/auth/invitation**", (route) =>
      route.fulfill({
        status: 422,
        json: {
          errors: [
            {
              code: "invalid_token",
              message: "This invitation link is invalid, has expired, or has already been used.",
            },
          ],
        },
      })
    )

    await page.goto("/accept-invitation?token=stale")

    await expect(page.getByText(/this invitation can't be used/i)).toBeVisible()
    await expect(page.getByLabel("Create password")).toHaveCount(0)
  })

  test("says so when the link has no token at all", async ({ page }) => {
    await page.route("**/api/v1/auth/me", (route) =>
      route.fulfill({
        status: 401,
        json: { errors: [{ code: "unauthenticated", message: "Not signed in" }] },
      })
    )

    await page.goto("/accept-invitation")

    await expect(page.getByText("Invalid link")).toBeVisible()
  })
})

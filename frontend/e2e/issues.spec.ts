import { test, expect } from "@playwright/test"

const EMPLOYEE_ME_RESPONSE = {
  user: {
    id: "emp-user-1",
    firstName: "Bob",
    lastName: "Employee",
    email: "bob@example.com",
    emailVerifiedAt: new Date().toISOString(),
    status: "active",
    employeeRecord: { id: "emp-record-1" },
  },
  company: { id: "c1", name: "Acme Inc.", slug: "acme-inc" },
  roles: [{ id: "r2", name: "Employee", slug: "employee" }],
  permissions: ["employees.view"],
}

const ADMIN_ME_RESPONSE = {
  user: {
    id: "admin-user-1",
    firstName: "Ada",
    lastName: "Admin",
    email: "ada@example.com",
    emailVerifiedAt: new Date().toISOString(),
    status: "active",
  },
  company: { id: "c1", name: "Acme Inc.", slug: "acme-inc" },
  roles: [{ id: "r1", name: "Admin", slug: "admin" }],
  permissions: ["employees.view", "employees.create", "employees.update", "employees.delete", "employees.manage_reporting_managers"],
}

test("Employee role does not see Employees nav item", async ({ page }) => {
  await page.route("**/api/v1/auth/me", async (route) => {
    await route.fulfill({ json: { data: EMPLOYEE_ME_RESPONSE } })
  })

  await page.route("**/api/v1/employees/emp-record-1", async (route) => {
    await route.fulfill({
      json: {
        data: {
          id: "emp-record-1",
          companyId: "c1",
          employeeCode: "EMP-001",
          firstName: "Bob",
          lastName: "Employee",
          fullName: "Bob Employee",
          status: "active",
          roles: [{ id: "r2", name: "Employee", slug: "employee" }],
          managerHierarchy: { primary: null, secondary: null, final: null, departmentHead: null, projectManagers: [] },
          managerHierarchyComplete: false,
        },
      },
    })
  })

  await page.goto("/settings")
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible()

  // Sidebar navigation must NOT have Employees
  await expect(page.getByRole("link", { name: /^Employees$/i })).not.toBeVisible()
})

test("Settings route renders as a full page without a dialog overlay", async ({ page }) => {
  await page.route("**/api/v1/auth/me", async (route) => {
    await route.fulfill({ json: { data: ADMIN_ME_RESPONSE } })
  })

  await page.goto("/settings")
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "Settings sections" })).toBeVisible()
  await expect(page.getByRole("heading", { level: 2, name: "Account & Security" })).toBeVisible()

  // Must not have dialog role
  await expect(page.locator("role=dialog")).toHaveCount(0)
})

test("Employee row click navigates to full employee page with back button instead of slider", async ({ page }) => {
  await page.route("**/api/v1/auth/me", async (route) => {
    await route.fulfill({ json: { data: ADMIN_ME_RESPONSE } })
  })

  await page.route("**/api/v1/employees?*", async (route) => {
    await route.fulfill({
      json: {
        data: [
          {
            id: "emp-record-1",
            companyId: "c1",
            employeeCode: "EMP-001",
            firstName: "Marcus",
            lastName: "Lee",
            fullName: "Marcus Lee",
            status: "active",
            roles: [{ id: "r1", name: "Accountant", slug: "accountant" }],
            department: { id: "d1", name: "Finance" },
            designation: { id: "ds1", title: "Accountant" },
            currentLevel: "senior",
            managerHierarchy: { primary: null, secondary: null, final: null, departmentHead: null, projectManagers: [] },
            managerHierarchyComplete: false,
          },
        ],
        meta: { page: 1, perPage: 25, totalPages: 1, totalCount: 1 },
      },
    })
  })

  await page.route("**/api/v1/employees/emp-record-1", async (route) => {
    await route.fulfill({
      json: {
        data: {
          id: "emp-record-1",
          companyId: "c1",
          employeeCode: "EMP-001",
          firstName: "Marcus",
          lastName: "Lee",
          fullName: "Marcus Lee",
          status: "active",
          roles: [{ id: "r1", name: "Accountant", slug: "accountant" }],
          department: { id: "d1", name: "Finance" },
          designation: { id: "ds1", title: "Accountant" },
          currentLevel: "senior",
          managerHierarchy: { primary: null, secondary: null, final: null, departmentHead: null, projectManagers: [] },
          managerHierarchyComplete: false,
        },
      },
    })
  })

  await page.goto("/employees")
  await expect(page.getByRole("heading", { level: 1, name: "Employees" })).toBeVisible()

  // Click Marcus Lee in the table
  await page.getByText("Marcus Lee").click()

  // Must navigate to /employees/emp-record-1
  await expect(page).toHaveURL(/\/employees\/emp-record-1/)

  // Must have "Back to employees" button
  await expect(page.getByRole("button", { name: "Back to employees" })).toBeVisible()

  // Must not open a sheet / dialog
  await expect(page.locator("role=dialog")).toHaveCount(0)

  // Clicking "Back to employees" navigates back to /employees
  await page.getByRole("button", { name: "Back to employees" }).click()
  await expect(page).toHaveURL(/\/employees$/)
})

test("Settings closes side pane and adds open/close button only in settings", async ({ page }) => {
  await page.route("**/api/v1/auth/me", async (route) => {
    await route.fulfill({ json: { data: ADMIN_ME_RESPONSE } })
  })

  await page.route("**/api/v1/employees?*", async (route) => {
    await route.fulfill({
      json: {
        data: [],
        meta: { page: 1, perPage: 25, totalPages: 1, totalCount: 0 },
      },
    })
  })

  await page.goto("/employees")
  await expect(page.getByRole("heading", { level: 1, name: "Employees" })).toBeVisible()

  // On /employees: side pane is open and toggle button is NOT present
  await expect(page.locator("aside")).toBeVisible()
  await expect(page.getByRole("button", { name: "Open side panel" })).not.toBeVisible()
  await expect(page.getByRole("button", { name: "Close side panel" })).not.toBeVisible()

  // Click Settings in the sidebar
  await page.getByRole("link", { name: /^Settings$/i }).click()
  await expect(page).toHaveURL(/\/settings$/)

  // On /settings: side pane is closed and "Open side panel" button is visible
  await expect(page.locator("aside")).not.toBeVisible()
  const openBtn = page.getByRole("button", { name: "Open side panel" })
  await expect(openBtn).toBeVisible()

  // Click "Open side panel"
  await openBtn.click()

  // Side pane is now open, and button is now "Close side panel"
  await expect(page.locator("aside")).toBeVisible()
  const closeBtn = page.getByRole("button", { name: "Close side panel" })
  await expect(closeBtn).toBeVisible()

  // Click "Close side panel"
  await closeBtn.click()
  await expect(page.locator("aside")).not.toBeVisible()
  await expect(page.getByRole("button", { name: "Open side panel" })).toBeVisible()
})



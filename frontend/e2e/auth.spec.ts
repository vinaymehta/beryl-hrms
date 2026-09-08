import { test, expect } from "@playwright/test"

// Matches the real backend's Auth::MePresenter shape ({user, company, roles,
// permissions} as separate keys, not flattened) — see toAuthUser in
// features/auth/api.ts, which is what actually flattens this for the app.
const FAKE_ME_RESPONSE = {
  user: {
    id: "1",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    emailVerifiedAt: new Date().toISOString(),
    status: "active",
  },
  company: { id: "c1", name: "Acme Inc.", slug: "acme-inc" },
  roles: [{ id: "r1", name: "Admin", slug: "admin" }],
  permissions: ["employees.view"],
}

/**
 * Smoke test for the login -> dashboard -> logout flow, run against a
 * mocked API (the real Rails backend isn't part of this test run). Written
 * to the same request/response contract the real backend targets, so it
 * should keep passing once pointed at the live API in integration testing.
 */
test("login, see the dashboard, then log out", async ({ page }) => {
  let authenticated = false

  await page.route("**/api/v1/auth/me", async (route) => {
    if (authenticated) {
      await route.fulfill({ json: { data: FAKE_ME_RESPONSE } })
    } else {
      await route.fulfill({
        status: 401,
        json: { errors: [{ code: "unauthenticated", message: "Not signed in" }] },
      })
    }
  })

  await page.route("**/api/v1/auth/login", async (route) => {
    authenticated = true
    await route.fulfill({ json: { data: FAKE_ME_RESPONSE } })
  })

  await page.route("**/api/v1/auth/logout", async (route) => {
    authenticated = false
    await route.fulfill({ status: 204, body: "" })
  })

  await page.goto("/login")
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible()

  await page.getByLabel(/email/i).fill("ada@example.com")
  await page.getByLabel(/^password$/i).fill("supersecret123")
  await page.getByRole("button", { name: /sign in/i }).click()

  await expect(page.getByRole("heading", { name: /welcome back, ada/i })).toBeVisible()
  await expect(page.getByText("Acme Inc.")).toBeVisible()

  await page.getByRole("button", { name: new RegExp(FAKE_ME_RESPONSE.user.firstName) }).click()
  await page.getByRole("menuitem", { name: /sign out/i }).click()

  await expect(page).toHaveURL(/\/login$/)
})

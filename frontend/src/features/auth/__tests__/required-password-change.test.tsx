import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

/**
 * When an admin has required a new password, the app itself is replaced —
 * not routed away from.
 *
 * A redirect can be navigated back out of; a shell that renders something else
 * has no nav to navigate with. This is still only the visible half: the API
 * refuses every other endpoint with `password_change_required` whatever the
 * client does (see forced_password_change_spec.rb), so what these cover is
 * that the person is told what to do rather than met with a wall of failures.
 */

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  user: null as Record<string, unknown> | null,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: mocks.replace }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock("@/features/auth/hooks/use-current-user", () => ({
  CURRENT_USER_QUERY_KEY: ["auth", "me"],
  useCurrentUser: () => ({
    user: mocks.user,
    isLoading: false,
    isError: false,
    isAuthenticated: !!mocks.user,
    isUnauthenticated: !mocks.user,
    refetch: vi.fn(),
  }),
}))

// The shell renders the real sidebar/topbar otherwise, which drag in a lot of
// unrelated data hooks; these stand in so the assertions are about the gate.
vi.mock("@/components/layout/sidebar", () => ({ Sidebar: () => <nav data-testid="sidebar" /> }))
vi.mock("@/components/layout/topbar", () => ({ Topbar: () => <header data-testid="topbar" /> }))

import { DashboardShell } from "@/components/layout/dashboard-shell"

function renderShell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <DashboardShell>
        <div data-testid="app-content">the actual app</div>
      </DashboardShell>
    </QueryClientProvider>
  )
}

const BASE_USER = {
  id: "u1",
  companyId: "c1",
  companyName: "Acme",
  firstName: "Noor",
  lastName: "Haddad",
  email: "noor@acme.test",
  employeeId: "e1",
  emailVerifiedAt: null,
  status: "active",
  roles: [],
  permissions: [],
  mustChangePassword: false,
}

beforeEach(() => vi.clearAllMocks())

describe("an account that owes a password change", () => {
  beforeEach(() => {
    mocks.user = { ...BASE_USER, mustChangePassword: true }
  })

  it("replaces the app with the change-password screen", () => {
    renderShell()

    expect(screen.getByText("Choose a new password")).toBeInTheDocument()
    expect(screen.queryByTestId("app-content")).not.toBeInTheDocument()
  })

  it("leaves no navigation to slip past it with", () => {
    renderShell()

    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument()
    expect(screen.queryByTestId("topbar")).not.toBeInTheDocument()
  })

  it("says who is asking and why, rather than just blocking" , () => {
    renderShell()

    expect(screen.getByText(/administrator has asked you to set a new password/i)).toBeInTheDocument()
  })

  it("still offers a way out, so nobody is trapped in the tab", () => {
    renderShell()

    expect(screen.getByRole("button", { name: /sign out instead/i })).toBeInTheDocument()
  })

  it("carries the show/hide toggle on every field, like every other password form", () => {
    renderShell()

    // Current, new, confirm.
    expect(screen.getAllByRole("button", { name: /show password/i })).toHaveLength(3)
  })
})

describe("an ordinary account", () => {
  beforeEach(() => {
    mocks.user = { ...BASE_USER }
  })

  it("sees the app, untouched" , () => {
    renderShell()

    expect(screen.getByTestId("app-content")).toBeInTheDocument()
    expect(screen.getByTestId("sidebar")).toBeInTheDocument()
    expect(screen.queryByText("Choose a new password")).not.toBeInTheDocument()
  })
})

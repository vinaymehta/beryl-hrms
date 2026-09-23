import { Suspense } from "react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { act, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { NAV_ITEMS } from "@/constants/nav"
import { PEOPLE_MANAGEMENT_PERMISSIONS, PERMISSIONS } from "@/constants/permissions"

/**
 * An employee's own record is reached at /profile, with no id anywhere in the
 * URL. These cover the three ways that could regress: a redirect that still
 * points at /employees/<id>, the by-id route staying open to an employee, and
 * /profile reading its id from somewhere other than the session.
 */

const replace = vi.fn()
const push = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/profile",
  useSearchParams: () => new URLSearchParams(),
}))

// Swapped per test — every hook under test reads identity through this one.
let currentUser: {
  id: string
  firstName: string
  lastName: string
  email: string
  companyName: string
  employeeId: string | null
  roles: { id: string; name: string; slug: string }[]
  permissions: string[]
} | null = null
let isUserLoading = false

vi.mock("@/features/auth/hooks/use-current-user", () => ({
  useCurrentUser: () => ({
    user: currentUser,
    isLoading: isUserLoading,
    isAuthenticated: !!currentUser,
  }),
}))

const mockEmployee = {
  id: "emp-9",
  companyId: "c1",
  employeeCode: "EMP-009",
  firstName: "Sofia",
  lastName: "Rivera",
  fullName: "Sofia Rivera",
  status: "active",
  roles: [{ id: "r1", name: "Employee", slug: "employee" }],
  department: { id: "d1", name: "Finance" },
  designation: { id: "ds1", title: "Analyst" },
  currentLevel: "senior",
  dateOfJoining: "2025-09-19",
  managerHierarchy: { primary: null, secondary: null, final: null, departmentHead: null, projectManagers: [] },
  managerHierarchyComplete: false,
}

// Captures the id the page asks for, which is the thing actually under test:
// it must come from the session, not from a route param.
const requestedIds: string[] = []
vi.mock("@/features/employees/hooks/use-employees", () => ({
  useEmployee: (id: string) => {
    requestedIds.push(id)
    return { data: mockEmployee, isLoading: false, isError: false, refetch: vi.fn() }
  },
  useEmployees: () => ({
    data: { data: [], meta: { page: 1, perPage: 25, totalPages: 1, totalCount: 0 } },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  // The list page's filter bar reaches for these; neither is what is under test.
  useDepartments: () => ({ data: [], isLoading: false }),
  useDesignations: () => ({ data: [], isLoading: false }),
}))

vi.mock("@/features/employees/hooks/use-employee-mutations", () => ({
  useUpdateEmployee: () => ({ mutate: vi.fn(), isPending: false }),
  useDeactivateEmployee: () => ({ mutate: vi.fn(), isPending: false }),
  useReactivateEmployee: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateEmployee: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock("@/features/dashboard/hooks/use-dashboard-summary", () => ({
  useDashboardSummary: () => ({ data: { employeeCount: 3, departmentCount: 2 }, isLoading: false }),
}))

vi.mock("@/features/documents/components/employee-documents-section", () => ({
  EmployeeDocumentsSection: () => <div data-testid="documents-section" />,
}))

import ProfilePage from "@/app/(dashboard)/profile/page"
import DashboardPage from "@/app/(dashboard)/page"
import EmployeesListPage from "@/app/(dashboard)/employees/page"
import EmployeeByIdPage from "@/app/(dashboard)/employees/[id]/page"
import { SidebarNav } from "@/components/layout/sidebar-nav"

const EMPLOYEE = {
  id: "u1",
  firstName: "Sofia",
  lastName: "Rivera",
  email: "sofia@acme.test",
  companyName: "Acme",
  employeeId: "emp-9",
  roles: [{ id: "r1", name: "Employee", slug: "employee" }],
  permissions: ["employees.view", "notifications.view"],
}

const HR = {
  ...EMPLOYEE,
  id: "u2",
  employeeId: "emp-2",
  roles: [{ id: "r2", name: "HR", slug: "hr" }],
  permissions: [
    PERMISSIONS.employeesView,
    PERMISSIONS.employeesCreate,
    PERMISSIONS.employeesUpdate,
    PERMISSIONS.employeesDelete,
  ] as string[],
}

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

/**
 * The by-id page reads its route param with `use(params)`, which suspends
 * until the promise settles — so it needs a boundary to suspend into, and the
 * assertions have to wait for the resume. Rendering it bare would assert
 * against the suspended frame, where nothing has run yet.
 */
async function renderByIdPage(id: string) {
  const params = Promise.resolve({ id })
  await act(async () => {
    renderWithProviders(
      <Suspense fallback={<div data-testid="suspended" />}>
        <EmployeeByIdPage params={params} />
      </Suspense>
    )
    await params
  })
}

beforeEach(() => {
  replace.mockClear()
  push.mockClear()
  requestedIds.length = 0
  isUserLoading = false
  currentUser = null
})

describe("/profile route", () => {
  it("loads the signed-in user's own employee record, taking the id from the session", () => {
    currentUser = EMPLOYEE
    renderWithProviders(<ProfilePage />)

    expect(requestedIds).toEqual(["emp-9"])
    expect(screen.getByText("Sofia Rivera")).toBeInTheDocument()
  })

  it("offers no way back to the employees list, which the employee never came from", () => {
    currentUser = EMPLOYEE
    renderWithProviders(<ProfilePage />)

    expect(screen.queryByRole("button", { name: /back to employees/i })).not.toBeInTheDocument()
  })

  it("hides the back button for HR too — their own profile is not a drill-down", () => {
    currentUser = HR
    renderWithProviders(<ProfilePage />)

    expect(requestedIds).toEqual(["emp-2"])
    expect(screen.queryByRole("button", { name: /back to employees/i })).not.toBeInTheDocument()
  })

  it("sends a login with no employee record back to the dashboard rather than erroring", () => {
    currentUser = { ...EMPLOYEE, employeeId: null }
    renderWithProviders(<ProfilePage />)

    expect(replace).toHaveBeenCalledWith("/")
    expect(requestedIds).toEqual([])
  })

  it("renders nothing but a skeleton until the session is known", () => {
    isUserLoading = true
    currentUser = null
    renderWithProviders(<ProfilePage />)

    expect(requestedIds).toEqual([])
    expect(replace).not.toHaveBeenCalled()
  })
})

describe("/employees/[id] stays HR/Admin-only", () => {
  it("lets a people manager open any employee by id", async () => {
    currentUser = HR
    await renderByIdPage("emp-77")

    await waitFor(() => expect(requestedIds).toEqual(["emp-77"]))
    expect(replace).not.toHaveBeenCalled()
  })

  it("bounces an employee to /profile instead of letting them pick an id", async () => {
    currentUser = EMPLOYEE
    await renderByIdPage("emp-77")

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/profile"))
  })

  it("does not render the requested record on the way out", async () => {
    currentUser = EMPLOYEE
    await renderByIdPage("emp-77")

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/profile"))
    expect(requestedIds).toEqual([])
    expect(screen.queryByText("Sofia Rivera")).not.toBeInTheDocument()
  })

  it("bounces an employee even when the id is their own, so no id is ever on show", async () => {
    currentUser = EMPLOYEE
    await renderByIdPage("emp-9")

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/profile"))
    expect(requestedIds).toEqual([])
  })
})

describe("navigation", () => {
  it("routes My Profile to /profile, with no id in the href", () => {
    const profileNav = NAV_ITEMS.find((item) => item.href === "/profile")

    expect(profileNav).toBeDefined()
    expect(profileNav?.label).toBe("My Profile")
    expect(profileNav?.requiresEmployeeRecord).toBe(true)
    // Not a privilege: an employee must see their own profile link.
    expect(profileNav?.permission).toBeUndefined()
    // ...but people managers get it through Employees instead.
    expect(profileNav?.hiddenFor).toEqual(PEOPLE_MANAGEMENT_PERMISSIONS)
  })

  it("places My Profile directly above Appraisal, both above Settings", () => {
    const order = NAV_ITEMS.map((item) => item.href)
    const profile = order.indexOf("/profile")
    const appraisal = order.indexOf("/appraisals")

    expect(appraisal).toBe(profile + 1)
    expect(appraisal).toBeLessThan(order.indexOf("/settings"))
  })

  it("keeps Employees gated behind people-management permissions", () => {
    const employeesNav = NAV_ITEMS.find((item) => item.href === "/employees")

    expect(employeesNav).toBeDefined()
    expect(employeesNav?.permission).toEqual(PEOPLE_MANAGEMENT_PERMISSIONS)
  })

  it("shows My Profile and hides Employees for an employee", () => {
    currentUser = EMPLOYEE
    renderWithProviders(<SidebarNav />)

    expect(screen.getByRole("link", { name: /my profile/i })).toHaveAttribute("href", "/profile")
    expect(screen.queryByRole("link", { name: /^employees$/i })).not.toBeInTheDocument()
  })

  // HR opens their own record from the directory they already manage, so a
  // second entry point to the same page would just be clutter in their nav.
  it("hides My Profile from HR, who reach their record through Employees", () => {
    currentUser = HR
    renderWithProviders(<SidebarNav />)

    expect(screen.queryByRole("link", { name: /my profile/i })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: /^employees$/i })).toHaveAttribute("href", "/employees")
  })

  it("still lets HR open /profile directly — only the nav entry is withheld", () => {
    currentUser = HR
    renderWithProviders(<ProfilePage />)

    expect(replace).not.toHaveBeenCalled()
    expect(requestedIds).toEqual(["emp-2"])
  })

  it("hides My Profile from a login with no employee record", () => {
    currentUser = { ...HR, employeeId: null }
    renderWithProviders(<SidebarNav />)

    expect(screen.queryByRole("link", { name: /my profile/i })).not.toBeInTheDocument()
  })
})

describe("employees are redirected to /profile, never to an id", () => {
  it("sends an employee landing on the dashboard to /profile", () => {
    currentUser = EMPLOYEE
    renderWithProviders(<DashboardPage />)

    expect(replace).toHaveBeenCalledWith("/profile")
    // The old behaviour, which put their own id in the address bar.
    expect(replace).not.toHaveBeenCalledWith(`/employees/${EMPLOYEE.employeeId}`)
  })

  it("sends an employee landing on /employees to /profile", () => {
    currentUser = EMPLOYEE
    renderWithProviders(<EmployeesListPage />)

    expect(replace).toHaveBeenCalledWith("/profile")
    expect(replace).not.toHaveBeenCalledWith(`/employees/${EMPLOYEE.employeeId}`)
  })

  it("leaves HR on the dashboard — it is their page", () => {
    currentUser = HR
    renderWithProviders(<DashboardPage />)

    expect(replace).not.toHaveBeenCalled()
    expect(screen.getByRole("heading", { level: 1, name: /welcome back/i })).toBeInTheDocument()
  })

  it("leaves HR on the employees list", () => {
    currentUser = HR
    renderWithProviders(<EmployeesListPage />)

    expect(replace).not.toHaveBeenCalled()
    expect(screen.getByRole("heading", { level: 1, name: "Employees" })).toBeInTheDocument()
  })

  it("keeps an admin with no employee record on the dashboard — there is nowhere to send them", () => {
    currentUser = { ...EMPLOYEE, employeeId: null }
    renderWithProviders(<DashboardPage />)

    expect(replace).not.toHaveBeenCalled()
  })
})

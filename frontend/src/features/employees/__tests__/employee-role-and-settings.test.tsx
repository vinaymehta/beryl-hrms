import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { NAV_ITEMS } from "@/constants/nav"
import { PEOPLE_MANAGEMENT_PERMISSIONS } from "@/constants/permissions"
import { SettingsView } from "@/features/settings/components/settings-dialog"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/features/auth/hooks/use-current-user", () => ({
  useCurrentUser: () => ({
    user: {
      id: "u1",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      companyName: "Acme",
      roles: [{ id: "r1", name: "Employee", slug: "employee" }],
      permissions: ["employees.view"],
    },
    isLoading: false,
    isAuthenticated: true,
  }),
}))

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe("Issue 1: Employee Role Navigation", () => {
  it("requires PEOPLE_MANAGEMENT_PERMISSIONS for Employees nav item so Employee role cannot see it", () => {
    const employeesNav = NAV_ITEMS.find((item) => item.href === "/employees")
    expect(employeesNav).toBeDefined()
    expect(employeesNav?.permission).toEqual(PEOPLE_MANAGEMENT_PERMISSIONS)

    const employeePermissions = ["employees.view"]
    const canSee = (PEOPLE_MANAGEMENT_PERMISSIONS as string[]).some((p) =>
      employeePermissions.includes(p)
    )
    expect(canSee).toBe(false)
  })

  it("permits HR/Admin with PEOPLE_MANAGEMENT_PERMISSIONS to see the Employees nav item", () => {
    const hrPermissions = ["employees.create", "employees.update", "employees.delete"]
    const canSee = (PEOPLE_MANAGEMENT_PERMISSIONS as string[]).some((p) =>
      hrPermissions.includes(p)
    )
    expect(canSee).toBe(true)
  })
})

import { EmployeeDetailContent } from "@/features/employees/components/employee-detail-content"

const mockEmployee = {
  id: "emp-1",
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
  dateOfJoining: "2025-09-19",
  managerHierarchy: { primary: null, secondary: null, final: null, departmentHead: null, projectManagers: [] },
  managerHierarchyComplete: false,
}

vi.mock("@/features/employees/hooks/use-employees", () => ({
  useEmployee: () => ({ data: mockEmployee, isLoading: false, isError: false }),
}))

vi.mock("@/features/employees/hooks/use-employee-mutations", () => ({
  useUpdateEmployee: () => ({ mutate: vi.fn(), isPending: false }),
  useDeactivateEmployee: () => ({ mutate: vi.fn(), isPending: false }),
  useReactivateEmployee: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock("@/features/documents/components/employee-documents-section", () => ({
  EmployeeDocumentsSection: () => <div data-testid="documents-section" />,
}))

describe("Issue 3: Settings Full Page", () => {
  it("renders SettingsView as a full-page layout without dialog overlay", () => {
    renderWithProviders(<SettingsView initialSection="account" />)

    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument()
    expect(screen.getByRole("navigation", { name: "Settings sections" })).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("displays Account & Security as initial section", () => {
    renderWithProviders(<SettingsView initialSection="account" />)

    expect(screen.getByRole("heading", { level: 2, name: "Account & Security" })).toBeInTheDocument()
  })
})

describe("Employee Profile Page with Back Button inplace of Slider", () => {
  it("does not render Back to employees button for Employee role by default", () => {
    renderWithProviders(<EmployeeDetailContent employeeId="emp-1" />)
    expect(screen.queryByRole("button", { name: /Back to employees/i })).not.toBeInTheDocument()
  })

  it("renders Back to employees button when showBackButton is explicitly true or for managers", () => {
    const handleBack = vi.fn()
    renderWithProviders(
      <EmployeeDetailContent employeeId="emp-1" showBackButton={true} onBack={handleBack} />
    )
    const backBtn = screen.getByRole("button", { name: /Back to employees/i })
    expect(backBtn).toBeInTheDocument()
    backBtn.click()
    expect(handleBack).toHaveBeenCalledTimes(1)
  })
})

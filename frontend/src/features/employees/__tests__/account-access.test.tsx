import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

/**
 * The admin's side of the invitation flow.
 *
 * The property under test throughout is an absence: there is no field, button
 * or code path here by which an administrator chooses, types or reads an
 * employee's password. Both actions send a link to the employee's own mailbox
 * and report nothing but the address it went to.
 */

const mocks = vi.hoisted(() => ({
  invite: vi.fn(),
  resetPassword: vi.fn(),
}))

vi.mock("@/features/employees/hooks/use-employee-mutations", () => ({
  useInviteEmployee: () => ({ mutate: mocks.invite, isPending: false }),
  useResetEmployeePassword: () => ({ mutate: mocks.resetPassword, isPending: false }),
}))

import { AccountAccess } from "@/features/employees/components/account-access"
import type { Employee, EmployeeAccount } from "@/types/employees"

const BASE_ACCOUNT: EmployeeAccount = {
  id: "u1",
  email: "noor@acme.test",
  status: "invited",
  emailVerifiedAt: null,
  lastLoginAt: null,
  invitedAt: null,
  invitationAcceptedAt: null,
  invitationPending: false,
  invitationUnsent: true,
  mustChangePassword: false,
}

function employee(account: Partial<EmployeeAccount> | null): Employee {
  return {
    id: "emp-1",
    firstName: "Noor",
    lastName: "Haddad",
    roles: [{ id: "r1", name: "Employee", slug: "employee" }],
    user: account === null ? null : { ...BASE_ACCOUNT, ...account },
  } as unknown as Employee
}

beforeEach(() => vi.clearAllMocks())

describe("an employee who has been created but not invited", () => {
  const notInvited = employee({})

  it("says so, and offers to send the invitation", () => {
    render(<AccountAccess employee={notInvited} canManage />)

    expect(screen.getByText("Not invited")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /send invitation/i })).toBeInTheDocument()
  })

  it("sends it on click", async () => {
    const user = userEvent.setup()
    render(<AccountAccess employee={notInvited} canManage />)

    await user.click(screen.getByRole("button", { name: /send invitation/i }))

    expect(mocks.invite).toHaveBeenCalledWith({ id: "emp-1", forcePasswordChange: false })
  })
})

describe("an employee whose invitation is outstanding", () => {
  const pending = employee({
    invitedAt: "2026-09-20T09:00:00Z",
    invitationPending: true,
    invitationUnsent: false,
  })

  it("shows when it went out, so a chase-up has something to go on", () => {
    render(<AccountAccess employee={pending} canManage />)

    expect(screen.getByText("Invitation sent")).toBeInTheDocument()
    expect(screen.getByText(/Waiting for them to choose a password/)).toBeInTheDocument()
  })

  it("offers to resend rather than to reset a password that doesn't exist yet" , () => {
    render(<AccountAccess employee={pending} canManage />)

    expect(screen.getByRole("button", { name: /resend invitation/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /password reset/i })).not.toBeInTheDocument()
  })
})

describe("an employee who has set their account up", () => {
  const active = employee({
    status: "active",
    invitedAt: "2026-09-20T09:00:00Z",
    invitationAcceptedAt: "2026-09-21T10:00:00Z",
    invitationPending: false,
    invitationUnsent: false,
  })

  it("offers a password reset, not another invitation", () => {
    render(<AccountAccess employee={active} canManage />)

    expect(screen.getByText("Active")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /send password reset/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /invitation/i })).not.toBeInTheDocument()
  })

  it("confirms before sending, because it puts mail in somebody's inbox", async () => {
    const user = userEvent.setup()
    render(<AccountAccess employee={active} canManage />)

    await user.click(screen.getByRole("button", { name: /send password reset/i }))
    expect(await screen.findByText(/send a password reset\?/i)).toBeInTheDocument()
    // Nothing has been sent yet.
    expect(mocks.resetPassword).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: /send reset link/i }))
    await waitFor(() => expect(mocks.resetPassword).toHaveBeenCalled())
    expect(mocks.resetPassword.mock.calls[0][0]).toBe("emp-1")
  })

  it("says the employee's current password keeps working until they use the link", async () => {
    const user = userEvent.setup()
    render(<AccountAccess employee={active} canManage />)

    await user.click(screen.getByRole("button", { name: /send password reset/i }))

    expect(await screen.findByText(/current password keeps working until they use it/i)).toBeInTheDocument()
  })
})

describe("what an administrator is never offered", () => {
  const active = employee({
    status: "active",
    invitationAcceptedAt: "2026-09-21T10:00:00Z",
    invitationUnsent: false,
  })

  it("has no password field of any kind", () => {
    const { container } = render(<AccountAccess employee={active} canManage />)

    expect(container.querySelector("input[type=password]")).toBeNull()
    expect(container.querySelectorAll("input")).toHaveLength(0)
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
  })

  it("says outright that they cannot see or set it", () => {
    render(<AccountAccess employee={active} canManage />)

    expect(screen.getByText(/can't see or set someone else's password/i)).toBeInTheDocument()
  })

  it("shows neither action to somebody without the right to manage accounts", () => {
    render(<AccountAccess employee={active} canManage={false} />)

    // The account itself is still readable — it is the actions that are gated.
    expect(screen.getByText("noor@acme.test")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /invitation|password reset/i })).not.toBeInTheDocument()
  })
})

describe("the force-password-update checkbox", () => {
  const notInvited = employee({})

  it("sits beside Invite, and is off unless the admin ticks it", () => {
    render(<AccountAccess employee={notInvited} canManage />)

    const box = screen.getByRole("checkbox", { name: /force password update/i })
    expect(box).toBeInTheDocument()
    expect(box).not.toBeChecked()
  })

  it("sends the requirement along with the invitation when ticked", async () => {
    const user = userEvent.setup()
    render(<AccountAccess employee={notInvited} canManage />)

    await user.click(screen.getByRole("checkbox", { name: /force password update/i }))
    await user.click(screen.getByRole("button", { name: /send invitation/i }))

    expect(mocks.invite).toHaveBeenCalledWith({ id: "emp-1", forcePasswordChange: true })
  })

  it("is gone once the account is set up — there is no first login left to force" , () => {
    render(<AccountAccess employee={employee({
      status: "active", invitationAcceptedAt: "2026-09-21T10:00:00Z", invitationUnsent: false,
    })} canManage />)

    expect(screen.queryByRole("checkbox", { name: /force password update/i })).not.toBeInTheDocument()
  })

  it("is hidden from somebody who can't manage the account", () => {
    render(<AccountAccess employee={notInvited} canManage={false} />)

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  it("shows an outstanding requirement, so it is visible a week later", () => {
    render(<AccountAccess employee={employee({
      invitedAt: "2026-09-20T09:00:00Z", invitationPending: true,
      invitationUnsent: false, mustChangePassword: true,
    })} canManage />)

    expect(screen.getByText(/choose a new password before they can use the app/i)).toBeInTheDocument()
  })

  it("says nothing when no requirement is outstanding", () => {
    render(<AccountAccess employee={employee({
      invitedAt: "2026-09-20T09:00:00Z", invitationPending: true, invitationUnsent: false,
    })} canManage />)

    expect(screen.queryByText(/choose a new password before they can use the app/i)).not.toBeInTheDocument()
  })
})

describe("an employee with no login account at all", () => {
  it("explains what to do first instead of offering a dead button", () => {
    render(<AccountAccess employee={employee(null)} canManage />)

    expect(screen.getByText(/Add a work email from Edit/)).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})

import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

/**
 * Two things, both of which are easy to regress by accident.
 *
 * First: every password field in the app carries the same show/hide toggle,
 * and toggling never disturbs what has been typed. The lint rule in
 * eslint.config.mjs stops a raw <input type="password"> being added at all;
 * these cover the behaviour the shared component is supposed to have.
 *
 * Second: the invitation page. An administrator never sets a password, so the
 * only place this account's first password is ever chosen is here — which
 * means an expired or spent link has to fail clearly rather than silently.
 */

// vi.mock is hoisted above every const in the file, so the spies the factories
// close over have to be created by vi.hoisted rather than declared here.
const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  invitation: vi.fn(),
  acceptInvitation: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: vi.fn() }),
  usePathname: () => "/accept-invitation",
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}))

vi.mock("@/features/auth/api", () => ({
  authApi: {
    invitation: mocks.invitation,
    acceptInvitation: mocks.acceptInvitation,
    login: vi.fn(),
    resetPassword: vi.fn(),
    changePassword: vi.fn(),
    register: vi.fn(),
    forgotPassword: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    verifyEmail: vi.fn(),
    sessions: vi.fn(),
    revokeSession: vi.fn(),
  },
}))

const { push, invitation, acceptInvitation } = mocks

import { PasswordInput } from "@/components/ui/password-input"
import { AcceptInvitationForm } from "@/features/auth/components/accept-invitation-form"
import { LoginForm } from "@/features/auth/components/login-form"
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form"
import { ChangePasswordForm } from "@/features/auth/components/change-password-form"

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  invitation.mockResolvedValue({
    email: "noor@acme.test",
    firstName: "Noor",
    lastName: "Haddad",
    companyName: "Acme",
  })
})

describe("the shared password field", () => {
  it("starts hidden and reveals on the toggle", async () => {
    const user = userEvent.setup()
    render(<PasswordInput aria-label="Password" defaultValue="" />)

    const field = screen.getByLabelText("Password")
    expect(field).toHaveAttribute("type", "password")

    await user.click(screen.getByRole("button", { name: "Show password" }))
    expect(field).toHaveAttribute("type", "text")

    await user.click(screen.getByRole("button", { name: "Hide password" }))
    expect(field).toHaveAttribute("type", "password")
  })

  it("does not clear, change or reformat the value when toggled", async () => {
    const user = userEvent.setup()
    render(<PasswordInput aria-label="Password" />)

    const field = screen.getByLabelText("Password") as HTMLInputElement
    const typed = "  Mixed Case & symbols !£$ 123  "
    await user.type(field, typed)
    expect(field.value).toBe(typed)

    await user.click(screen.getByRole("button", { name: "Show password" }))
    expect(field.value).toBe(typed)

    await user.click(screen.getByRole("button", { name: "Hide password" }))
    expect(field.value).toBe(typed)
  })

  it("keeps tab order going field to field rather than stopping on the eye", () => {
    render(<PasswordInput aria-label="Password" />)

    expect(screen.getByRole("button", { name: "Show password" })).toHaveAttribute("tabindex", "-1")
  })
})

describe("every password form in the app", () => {
  // Named rather than looped over a list of files, so a failure says which
  // screen lost its toggle.
  const forms: [string, () => React.ReactElement, number][] = [
    ["Login", () => <LoginForm />, 1],
    ["Reset password", () => <ResetPasswordForm token="t" />, 2],
    ["Change password", () => <ChangePasswordForm />, 3],
  ]

  it.each(forms)("gives %s a show/hide control on every password field", (_name, ui, count) => {
    renderWithProviders(ui())

    expect(screen.getAllByRole("button", { name: /show password/i })).toHaveLength(count)
  })

  it("gives the invitation form one on both fields", async () => {
    renderWithProviders(<AcceptInvitationForm token="tok" />)

    await screen.findByText(/Welcome, Noor/)
    expect(screen.getAllByRole("button", { name: /show password/i })).toHaveLength(2)
  })
})

describe("the invitation page", () => {
  it("greets the person and names the account they are claiming", async () => {
    renderWithProviders(<AcceptInvitationForm token="tok" />)

    expect(await screen.findByText(/Welcome, Noor/)).toBeInTheDocument()
    expect(screen.getByText(/noor@acme\.test/)).toBeInTheDocument()
    expect(screen.getByText(/invited to Acme/)).toBeInTheDocument()
  })

  it("never asks for a current password — this account has never had one", async () => {
    renderWithProviders(<AcceptInvitationForm token="tok" />)

    await screen.findByText(/Welcome, Noor/)
    expect(screen.queryByLabelText(/current password/i)).not.toBeInTheDocument()
  })

  it("sends the chosen password with the token", async () => {
    const user = userEvent.setup()
    acceptInvitation.mockResolvedValue({ id: "u1", email: "noor@acme.test", roles: [], permissions: [] })
    renderWithProviders(<AcceptInvitationForm token="tok" />)

    await screen.findByText(/Welcome, Noor/)
    await user.type(screen.getByLabelText("Create password"), "employee-chosen-1")
    await user.type(screen.getByLabelText("Confirm password"), "employee-chosen-1")
    await user.click(screen.getByRole("button", { name: /set password and sign in/i }))

    await waitFor(() =>
      expect(acceptInvitation).toHaveBeenCalledWith("tok", "employee-chosen-1", "employee-chosen-1")
    )
  })

  it("signs them straight in rather than asking them to change it again", async () => {
    const user = userEvent.setup()
    acceptInvitation.mockResolvedValue({ id: "u1", email: "noor@acme.test", roles: [], permissions: [] })
    renderWithProviders(<AcceptInvitationForm token="tok" />)

    await screen.findByText(/Welcome, Noor/)
    await user.type(screen.getByLabelText("Create password"), "employee-chosen-1")
    await user.type(screen.getByLabelText("Confirm password"), "employee-chosen-1")
    await user.click(screen.getByRole("button", { name: /set password and sign in/i }))

    // Straight to the app, not back to /login and not to a change-password step.
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"))
  })

  it("refuses to submit a mismatched confirmation", async () => {
    const user = userEvent.setup()
    renderWithProviders(<AcceptInvitationForm token="tok" />)

    await screen.findByText(/Welcome, Noor/)
    await user.type(screen.getByLabelText("Create password"), "employee-chosen-1")
    await user.type(screen.getByLabelText("Confirm password"), "something-else-2")
    await user.click(screen.getByRole("button", { name: /set password and sign in/i }))

    expect(await screen.findByText(/passwords don't match/i)).toBeInTheDocument()
    expect(acceptInvitation).not.toHaveBeenCalled()
  })

  it("says plainly when the link is spent or expired, before anything is typed", async () => {
    invitation.mockRejectedValue(new Error("invalid_token"))
    renderWithProviders(<AcceptInvitationForm token="stale" />)

    expect(await screen.findByText(/this invitation can't be used/i)).toBeInTheDocument()
    expect(screen.getByText(/ask your administrator to send a fresh invitation/i)).toBeInTheDocument()
    // And there is nothing to fill in, so nobody types a password into a dead link.
    expect(screen.queryByLabelText("Create password")).not.toBeInTheDocument()
  })
})

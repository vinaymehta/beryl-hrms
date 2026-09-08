import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { LoginForm } from "@/features/auth/components/login-form"
import { authApi } from "@/features/auth/api"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

vi.mock("@/features/auth/api", () => ({
  authApi: {
    login: vi.fn(),
  },
}))

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.mocked(authApi.login).mockReset()
  })

  it("shows validation errors when submitted empty", async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginForm />)

    await user.click(screen.getByRole("button", { name: /sign in/i }))

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument()
    expect(authApi.login).not.toHaveBeenCalled()
  })

  it("submits valid credentials to the API", async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      id: "1",
      companyId: "c1",
      companyName: "Acme",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      employeeId: null,
      emailVerifiedAt: null,
      status: "active",
      roles: [],
      permissions: [],
    })

    const user = userEvent.setup()
    renderWithProviders(<LoginForm />)

    await user.type(screen.getByLabelText(/email/i), "ada@example.com")
    await user.type(screen.getByLabelText(/^password$/i), "supersecret123")
    await user.click(screen.getByRole("button", { name: /sign in/i }))

    // TanStack Query's mutationFn is invoked with an internal context object
    // as a second argument — assert loosely on that one with expect.anything().
    await waitFor(() =>
      expect(authApi.login).toHaveBeenCalledWith(
        { email: "ada@example.com", password: "supersecret123" },
        expect.anything()
      )
    )
  })
})

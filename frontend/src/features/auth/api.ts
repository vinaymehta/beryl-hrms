import { apiClient } from "@/lib/api-client"
import type { AuthUser, InvitationSummary, MeResponse, SessionSummary } from "@/types/auth"
import type {
  ChangePasswordValues,
  ForgotPasswordValues,
  LoginValues,
  RegisterValues,
} from "@/features/auth/schemas"

// The backend returns { user, company, roles, permissions } as separate keys
// (see Auth::MePresenter) — flattened here, once, at the API boundary, so
// every other consumer in the app can keep working with the simpler flat
// AuthUser shape rather than reaching into raw.user.* everywhere.
function toAuthUser(raw: MeResponse): AuthUser {
  return {
    id: raw.user.id,
    companyId: raw.company.id,
    companyName: raw.company.name,
    firstName: raw.user.firstName,
    lastName: raw.user.lastName,
    email: raw.user.email,
    employeeId: raw.user.employeeId,
    emailVerifiedAt: raw.user.emailVerifiedAt,
    status: raw.user.status,
    roles: raw.roles,
    permissions: raw.permissions,
    mustChangePassword: raw.mustChangePassword ?? false,
  }
}

export const authApi = {
  me: () => apiClient.get<MeResponse>("/auth/me").then(toAuthUser),

  login: (values: LoginValues) =>
    apiClient.post<MeResponse>("/auth/login", values).then(toAuthUser),

  register: (values: RegisterValues) =>
    apiClient
      .post<MeResponse>("/auth/register", {
        companyName: values.companyName,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
        passwordConfirmation: values.passwordConfirmation,
      })
      .then(toAuthUser),

  logout: () => apiClient.delete<void>("/auth/logout"),

  verifyEmail: (token: string) =>
    apiClient.post<MeResponse>("/auth/verify_email", { token }).then(toAuthUser),

  forgotPassword: (values: ForgotPasswordValues) =>
    apiClient.post<void>("/auth/forgot_password", values),

  // Backend (PasswordsController#update) permits token/password/passwordConfirmation.
  resetPassword: (token: string, password: string, passwordConfirmation: string) =>
    apiClient.post<void>("/auth/reset_password", { token, password, passwordConfirmation }),

  // Backend (PasswordChangesController#update) reads currentPassword plus
  // newPassword/newPasswordConfirmation specifically (distinct key names
  // from the unauthenticated reset flow, since both a current and a new
  // password are in play here) — see app/controllers/api/v1/auth/password_changes_controller.rb.
  changePassword: (values: ChangePasswordValues) =>
    apiClient.patch<void>("/auth/change_password", {
      currentPassword: values.currentPassword,
      newPassword: values.password,
      newPasswordConfirmation: values.passwordConfirmation,
    }),

  // Who an invitation link is for, so the page can greet them by name and say
  // plainly that a link has expired rather than only failing on submit. The
  // backend returns the name, address and company and nothing else.
  invitation: (token: string) =>
    apiClient.get<InvitationSummary>(`/auth/invitation?token=${encodeURIComponent(token)}`),

  // Spends the invitation: sets the password the employee chose and signs them
  // in, so there is no second prompt to change a password they just picked.
  acceptInvitation: (token: string, password: string, passwordConfirmation: string) =>
    apiClient
      .post<MeResponse>("/auth/accept_invitation", { token, password, passwordConfirmation })
      .then(toAuthUser),

  sessions: () => apiClient.get<SessionSummary[]>("/auth/sessions"),

  revokeSession: (id: string) => apiClient.delete<void>(`/auth/sessions/${id}`),
}

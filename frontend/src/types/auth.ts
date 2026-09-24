export interface Role {
  id: string
  name: string
  slug: string
  /** Added by RoleSerializer for the roles picker; absent on older payloads. */
  description?: string | null
  /** True for the four roles every company is seeded with. */
  systemDefault?: boolean
}

export interface AuthUser {
  id: string
  companyId: string
  companyName: string
  firstName: string
  lastName: string
  email: string
  employeeId: string | null
  emailVerifiedAt: string | null
  status: "active" | "invited" | "disabled"
  roles: Role[]
  /** Flattened permission keys across all of the user's roles. UI-gating only. */
  permissions: string[]
  /**
   * Admin required a new password before this account may use the app. The
   * API enforces it too — this only decides what is rendered.
   */
  mustChangePassword: boolean
}

/**
 * What an unclaimed invitation link says about itself.
 *
 * Deliberately thin: whoever holds the token already knows the mailbox it was
 * sent to, so naming the person and the company tells them nothing new — but
 * nothing beyond that is exposed, because a token is not a login.
 */
export interface InvitationSummary {
  email: string
  firstName: string
  lastName: string
  companyName: string | null
}

export interface SessionSummary {
  id: string
  ipAddress: string
  userAgent: string
  createdAt: string
  /** The backend tracks expiry, not last-activity — see SessionSerializer. */
  expiresAt: string
  current: boolean
}

/**
 * Raw shape the backend actually returns for /auth/me, /auth/login,
 * /auth/register, /auth/verify_email (see Auth::MePresenter on the Rails
 * side) — company is a distinct object, not flattened onto the user. Mapped
 * to the flat `AuthUser` the rest of the frontend consumes by `toAuthUser`
 * in features/auth/api.ts, so this shape shouldn't leak past that boundary.
 */
export interface MeResponse {
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    emailVerifiedAt: string | null
    status: AuthUser["status"]
    employeeId: string | null
  }
  company: { id: string; name: string; slug: string }
  roles: Role[]
  permissions: string[]
  mustChangePassword: boolean
}

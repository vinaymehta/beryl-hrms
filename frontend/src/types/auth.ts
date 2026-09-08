export interface Role {
  id: string
  name: string
  slug: string
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
}

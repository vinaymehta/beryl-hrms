"use client"

import { useCurrentUser } from "@/features/auth/hooks/use-current-user"
import { ROLE_SLUGS } from "@/constants/permissions"

/**
 * Whether the signed-in user holds the Admin role. Gates the All Settings
 * workspace, which is for administrators only.
 *
 * UI-visibility only, like usePermission: every call behind All Settings is
 * still authorised by the API on its own permission keys.
 */
export function useIsAdmin(): boolean {
  const { user } = useCurrentUser()
  return !!user?.roles.some((role) => role.slug === ROLE_SLUGS.admin)
}

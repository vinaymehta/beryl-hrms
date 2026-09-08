"use client"

import { useCurrentUser } from "@/features/auth/hooks/use-current-user"
import type { PermissionKey } from "@/constants/permissions"

/**
 * UI-visibility gate only. The backend independently enforces every
 * protected action — this hook must never be treated as the real access
 * control, only as a hint for what to show/hide/disable in the UI.
 */
export function usePermission(key: PermissionKey | PermissionKey[]): boolean {
  const { user } = useCurrentUser()
  if (!user) return false

  const keys = Array.isArray(key) ? key : [key]
  return keys.some((k) => user.permissions.includes(k))
}

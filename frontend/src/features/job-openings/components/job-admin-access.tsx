"use client"

import type { ReactNode } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useCurrentUser } from "@/features/auth/hooks/use-current-user"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@/constants/permissions"

/**
 * The sidebar hides Job Administration from anyone without access; this
 * covers a typed-in URL, which would otherwise render an empty shell of 403s.
 */
export function JobAdminAccess({ children }: { children: ReactNode }) {
  const { user, isLoading } = useCurrentUser()
  const canManage = usePermission(PERMISSIONS.jobOpeningsManage)

  if (isLoading || !user) return null
  if (!canManage) {
    return (
      <Alert className="max-w-md">
        <AlertTitle>You don&apos;t have access to Job Administration</AlertTitle>
        <AlertDescription>Only administrators manage the openings on the careers website.</AlertDescription>
      </Alert>
    )
  }

  return <>{children}</>
}

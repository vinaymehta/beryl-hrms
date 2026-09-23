"use client"

import { use, useEffect } from "react"
import { useRouter } from "next/navigation"

import { EmployeeDetailContent } from "@/features/employees/components/employee-detail-content"
import { useCurrentUser } from "@/features/auth/hooks/use-current-user"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PEOPLE_MANAGEMENT_PERMISSIONS } from "@/constants/permissions"

/**
 * HR/Admin employee management — looking at somebody else's record by id.
 *
 * Anyone without people-management permissions is sent to /profile, whatever
 * id they typed. The API already refuses them anyone but themselves
 * (EmployeePolicy::Scope returns their own record alone, so another id 404s),
 * so this is not the security boundary; it is what stops an employee sitting
 * on a by-id URL at all — their own id is not theirs to see in the address
 * bar, and someone else's id should bounce rather than 404 at them.
 */
export default function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { isLoading } = useCurrentUser()
  const managesPeople = usePermission(PEOPLE_MANAGEMENT_PERMISSIONS)

  const redirectToOwnProfile = !isLoading && !managesPeople

  useEffect(() => {
    if (redirectToOwnProfile) router.replace("/profile")
  }, [redirectToOwnProfile, router])

  // Nothing of the requested record should paint on the way out.
  if (isLoading || redirectToOwnProfile) return null

  return <EmployeeDetailContent employeeId={id} />
}

"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { Skeleton } from "@/components/ui/skeleton"
import { EmployeeDetailContent } from "@/features/employees/components/employee-detail-content"
import { useCurrentUser } from "@/features/auth/hooks/use-current-user"

/**
 * "My profile" — the employee's own record, and only ever their own.
 *
 * The id is read from the authenticated session rather than the URL, which is
 * the whole point of this route existing: /employees/[id] takes whatever id is
 * typed into the address bar, so sending an employee there made their own
 * profile a guessable, editable URL. Here there is no id to change.
 *
 * This is presentation, not enforcement — the API is still the thing that
 * decides what an employee may read (EmployeePolicy::Scope). What this removes
 * is the invitation to try.
 */
export default function ProfilePage() {
  const router = useRouter()
  const { user, isLoading } = useCurrentUser()

  // A login with no employee record (a bare admin account, say) has no profile
  // to show. Sending them to the dashboard is better than an error for a page
  // that simply doesn't apply to them.
  const hasNoRecord = !isLoading && !!user && !user.employeeId

  useEffect(() => {
    if (hasNoRecord) router.replace("/")
  }, [hasNoRecord, router])

  if (isLoading || !user) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  if (hasNoRecord) return null

  return (
    <EmployeeDetailContent
      employeeId={String(user.employeeId)}
      // There is nowhere to go "back" to: an employee reaches this from the
      // nav, not by drilling into a list. Passing it explicitly rather than
      // letting the component infer it from permissions means an HR user
      // viewing their OWN profile doesn't get a "Back to employees" button
      // that returns them somewhere they never were.
      showBackButton={false}
    />
  )
}

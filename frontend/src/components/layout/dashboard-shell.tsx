"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { useCurrentUser } from "@/features/auth/hooks/use-current-user"
import { RequiredPasswordChange } from "@/features/auth/components/required-password-change"

export function DashboardShell({ children }: { children: ReactNode }) {
  const { user, isLoading, isAuthenticated, isUnauthenticated, isError, refetch } = useCurrentUser()
  const router = useRouter()

  useEffect(() => {
    if (isUnauthenticated) router.replace("/login")
  }, [isUnauthenticated, router])

  // Reaching the API failed for a reason other than "not logged in" — the
  // backend is down or the app was built pointing at an API host the browser
  // cannot reach. Previously this fell through to `return null` below and
  // rendered a blank page, which gives the user nothing to act on and looks
  // identical to a broken build.
  if (isError) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Couldn&apos;t reach the server</AlertTitle>
          <AlertDescription>
            The app loaded, but the API did not respond. It may be starting up, or unreachable from this browser.
          </AlertDescription>
          <AlertAction>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertAction>
        </Alert>
      </div>
    )
  }

  if (isLoading || isUnauthenticated) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="grid w-full max-w-sm gap-3 p-6">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  // Replaces the whole shell rather than redirecting: there is no nav, so
  // there is nowhere to navigate. The API enforces the same rule
  // independently — see Authentication#require_password_change_completed.
  if (user?.mustChangePassword) return <RequiredPasswordChange />

  return (
    <div className="flex min-h-svh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}

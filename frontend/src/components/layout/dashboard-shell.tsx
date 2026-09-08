"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"

import { Skeleton } from "@/components/ui/skeleton"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { useCurrentUser } from "@/features/auth/hooks/use-current-user"

export function DashboardShell({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, isUnauthenticated } = useCurrentUser()
  const router = useRouter()

  useEffect(() => {
    if (isUnauthenticated) router.replace("/login")
  }, [isUnauthenticated, router])

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

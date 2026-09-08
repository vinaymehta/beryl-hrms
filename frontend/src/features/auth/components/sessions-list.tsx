"use client"

import { MonitorIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useSessions } from "@/features/auth/hooks/use-sessions"
import { useRevokeSession } from "@/features/auth/hooks/use-auth-mutations"

export function SessionsList() {
  const { data: sessions, isLoading } = useSessions()
  const revokeSession = useRevokeSession()

  if (isLoading) {
    return (
      <div className="grid gap-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (!sessions?.length) {
    return <p className="text-sm text-muted-foreground">No active sessions.</p>
  }

  return (
    <ul className="grid gap-2">
      {sessions.map((session) => (
        <li
          key={session.id}
          className="flex items-center justify-between gap-4 rounded-lg border p-3"
        >
          <div className="flex items-center gap-3">
            <MonitorIcon className="size-5 shrink-0 text-muted-foreground" />
            <div className="grid gap-0.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                {session.userAgent || "Unknown device"}
                {session.current && <Badge variant="outline">This device</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {session.ipAddress} · expires {new Date(session.expiresAt).toLocaleString()}
              </p>
            </div>
          </div>
          {!session.current && (
            <Button
              variant="outline"
              size="sm"
              disabled={revokeSession.isPending}
              onClick={() => revokeSession.mutate(session.id)}
            >
              Revoke
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}

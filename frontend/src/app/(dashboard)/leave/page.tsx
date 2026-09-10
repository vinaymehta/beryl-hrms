"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { CalendarDaysIcon, CheckIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { LeaveStatusBadge } from "@/features/leave/components/leave-status-badge"
import { RequestLeaveDialog } from "@/features/leave/components/request-leave-dialog"
import { RejectLeaveDialog } from "@/features/leave/components/reject-leave-dialog"
import { useMyLeaveRequests, usePendingLeaveRequests, useReviewLeaveRequest } from "@/features/leave/hooks/use-leave"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@/constants/permissions"
import { HIDDEN_FEATURES } from "@/constants/feature-flags"

// Hidden for this rollout (see feature-flags.ts) — direct navigation here
// bounces to the dashboard instead of rendering the page below, which stays
// fully intact for when this flag flips back.
export default function LeavePage() {
  const router = useRouter()

  useEffect(() => {
    if (HIDDEN_FEATURES.leave) router.replace("/")
  }, [router])

  const canApprove = usePermission(PERMISSIONS.leaveApprove)
  const { data: myRequests, isLoading: myLoading } = useMyLeaveRequests()
  const { data: pending, isLoading: pendingLoading } = usePendingLeaveRequests()
  const { approve, reject } = useReviewLeaveRequest()

  if (HIDDEN_FEATURES.leave) return null

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-role-hr/12 text-role-hr">
            <CalendarDaysIcon className="size-4.5" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Leave</h1>
        </div>
        <RequestLeaveDialog />
      </div>

      {canApprove && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending approvals</CardTitle>
            <CardDescription>Requests waiting on your review.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {pendingLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : !pending?.length ? (
              <p className="text-sm text-muted-foreground">Nothing pending — you&apos;re all caught up.</p>
            ) : (
              pending.map((req) => (
                <div key={req.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">
                      {req.employeeName} · {req.leaveType}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {req.startDate} → {req.endDate} · {req.reason}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(req.id)}>
                      <CheckIcon /> Approve
                    </Button>
                    <RejectLeaveDialog
                      isPending={reject.isPending}
                      onConfirm={(reviewNote) => reject.mutate({ id: req.id, reviewNote })}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My requests</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {myLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : !myRequests?.length ? (
            <p className="text-sm text-muted-foreground">No leave requests yet.</p>
          ) : (
            myRequests.map((req) => (
              <div key={req.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{req.leaveType}</p>
                  <p className="text-xs text-muted-foreground">
                    {req.startDate} → {req.endDate} · {req.reason}
                  </p>
                  {req.reviewNote && (
                    <p className="mt-1 text-xs text-muted-foreground italic">&quot;{req.reviewNote}&quot;</p>
                  )}
                </div>
                <LeaveStatusBadge status={req.status} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

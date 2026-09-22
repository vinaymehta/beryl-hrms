"use client"

import { useState } from "react"
import { PlusIcon, PlayIcon, PencilIcon, CalendarClockIcon, UsersIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { CycleStatusBadge } from "@/features/appraisals/components/appraisal-badges"
import { CycleFormDialog } from "@/features/appraisals/components/cycle-form-dialog"
import { useAppraisalCycles, useAppraisalCycle } from "@/features/appraisals/hooks/use-appraisals"
import { useStartAppraisalCycle, useCloseAppraisalCycle } from "@/features/appraisals/hooks/use-appraisal-mutations"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@/constants/permissions"
import { APPRAISAL_STATUSES } from "@/features/appraisals/constants"
import type { AppraisalCycle } from "@/types/appraisals"

function ProgressBar({ cycle }: { cycle: AppraisalCycle }) {
  const total = cycle.appraisalCount || 0
  if (total === 0) return null

  return (
    <div className="grid gap-1">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        {APPRAISAL_STATUSES.filter((status) => cycle.statusCounts[status.value]).map((status) => {
          const count = cycle.statusCounts[status.value] ?? 0
          return (
            <span
              key={status.value}
              title={`${status.label}: ${count}`}
              className={status.className.split(" ")[0].replace("/15", "")}
              style={{ width: `${(count / total) * 100}%` }}
            />
          )
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {cycle.statusCounts.closed ?? 0} closed · {cycle.statusCounts.released ?? 0} released · {total} total
      </p>
    </div>
  )
}

export function AppraisalCyclesView({ onOpenCycle }: { onOpenCycle: (cycleId: string) => void }) {
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const canManage = usePermission(PERMISSIONS.appraisalCyclesManage)

  const { data: cycles, isLoading, isError, refetch } = useAppraisalCycles()
  const { data: editingCycle } = useAppraisalCycle(editingId)
  const startCycle = useStartAppraisalCycle()
  const closeCycle = useCloseAppraisalCycle()

  function openNew() {
    setEditingId(null)
    setFormOpen(true)
  }

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="grid gap-3 rounded-xl border border-dashed p-10 text-center">
        <p className="text-sm font-semibold">Couldn&apos;t load cycles</p>
        <div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {cycles?.length ?? 0} cycle{cycles?.length === 1 ? "" : "s"}
        </p>
        {canManage && (
          <Button onClick={openNew} className="gap-1.5">
            <PlusIcon className="size-4" /> New cycle
          </Button>
        )}
      </div>

      {(cycles?.length ?? 0) === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-xl border border-dashed p-12 text-center">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-role-hr/10 text-role-hr">
            <CalendarClockIcon className="size-5" />
          </span>
          <p className="text-sm font-semibold">No appraisal cycles yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            A cycle sets the period, the deadlines, the template and who is included. Create one to begin.
          </p>
          {canManage && (
            <Button size="sm" className="mt-1 gap-1.5" onClick={openNew}>
              <PlusIcon className="size-4" /> New cycle
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cycles?.map((cycle) => (
            <Card key={cycle.id} className="overflow-hidden">
              <CardContent className="grid gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => onOpenCycle(cycle.id)}
                  >
                    <p className="truncate font-semibold text-foreground hover:underline">{cycle.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {cycle.templateName} v{cycle.templateVersion}
                    </p>
                  </button>
                  <CycleStatusBadge status={cycle.status} />
                </div>

                <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="outline" className="gap-1">
                    <UsersIcon className="size-3" />
                    {cycle.started ? cycle.appraisalCount : cycle.eligibleCount} employees
                  </Badge>
                  {cycle.secondaryReviewEnabled && <Badge variant="outline">Secondary review</Badge>}
                  {cycle.employeeSubmissionDeadline && (
                    <Badge variant="outline">
                      Due {new Date(cycle.employeeSubmissionDeadline).toLocaleDateString()}
                    </Badge>
                  )}
                </div>

                <ProgressBar cycle={cycle} />

                {canManage && (
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    {!cycle.started && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => {
                            setEditingId(cycle.id)
                            setFormOpen(true)
                          }}
                        >
                          <PencilIcon className="size-3.5" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1.5 bg-role-hr text-role-hr-foreground hover:bg-role-hr/90"
                          disabled={startCycle.isPending || cycle.eligibleCount === 0}
                          onClick={() => startCycle.mutate(cycle.id)}
                        >
                          <PlayIcon className="size-3.5" /> Start
                        </Button>
                      </>
                    )}
                    {cycle.status === "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={closeCycle.isPending}
                        onClick={() => closeCycle.mutate(cycle.id)}
                      >
                        Close cycle
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CycleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        cycle={editingId ? editingCycle : undefined}
      />
    </div>
  )
}

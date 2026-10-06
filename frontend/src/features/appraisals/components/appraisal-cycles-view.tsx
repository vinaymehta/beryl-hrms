"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon, PlayIcon, PencilIcon, Trash2Icon, CalendarClockIcon, UsersIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CycleStatusBadge } from "@/features/appraisals/components/appraisal-badges"
import { CycleFormDialog } from "@/features/appraisals/components/cycle-form-dialog"
import { useAppraisalCycles, useAppraisalCycle, useAppraisalTemplates } from "@/features/appraisals/hooks/use-appraisals"
import {
  useStartAppraisalCycle,
  useCloseAppraisalCycle,
  useDeleteAppraisalCycle,
} from "@/features/appraisals/hooks/use-appraisal-mutations"
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

/**
 * Editing and deleting are locked only while a cycle is running.
 *
 * While it runs, people are writing self-appraisals against it and reviewers
 * are working to its deadlines; removing it underneath them would throw that
 * work away mid-flight. Close it first.
 *
 * A closed cycle can be edited and deleted again. Editing it is limited by the
 * form itself — once a cycle has started, its template and employee list are
 * fixed (CycleForm's `locked`), so only the name, description, dates and review
 * options change. Deleting it removes its appraisals too, which the
 * confirmation says in so many words.
 */
function locked(cycle: AppraisalCycle) {
  return cycle.status === "active"
}

function lockReason(cycle: AppraisalCycle) {
  if (cycle.status === "active") return "This cycle is running — close it first"
  return null
}

export function AppraisalCyclesView({ onOpenCycle }: { onOpenCycle: (cycleId: string) => void }) {
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const canManage = usePermission(PERMISSIONS.appraisalCyclesManage)
  const canManageTemplates = usePermission(PERMISSIONS.appraisalTemplatesManage)
  const router = useRouter()
  // A cycle can only be created on an ACTIVE template — the form's template
  // picker offers nothing else — so with none, the form is a dead end.
  const { data: activeTemplates, isLoading: templatesLoading } = useAppraisalTemplates("active", canManage)
  const [needsTemplate, setNeedsTemplate] = useState(false)

  const { data: cycles, isLoading, isError, refetch } = useAppraisalCycles()
  const { data: editingCycle } = useAppraisalCycle(editingId)
  const startCycle = useStartAppraisalCycle()
  const deleteCycle = useDeleteAppraisalCycle()
  const [deleting, setDeleting] = useState<AppraisalCycle | null>(null)
  const closeCycle = useCloseAppraisalCycle()

  function openNew() {
    // Still loading counts as "has one": the form's own picker fills in as the
    // list arrives, and blocking on a request in flight would just be a delay.
    if (!templatesLoading && (activeTemplates?.length ?? 0) === 0) {
      setNeedsTemplate(true)
      return
    }
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
                  {cycle.employeeSubmissionDeadline && (
                    <Badge variant="outline">
                      Due {new Date(cycle.employeeSubmissionDeadline).toLocaleDateString()}
                    </Badge>
                  )}
                </div>

                <ProgressBar cycle={cycle} />

                {canManage && (
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    {/* Edit and Delete are always SHOWN and conditionally
                        disabled, rather than appearing and disappearing. A
                        control that vanishes leaves people hunting for it and
                        never says why it is gone; a disabled one with a reason
                        on hover answers the question in place. */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={locked(cycle)}
                      title={lockReason(cycle) ?? `Edit ${cycle.name}`}
                      onClick={() => {
                        setEditingId(cycle.id)
                        setFormOpen(true)
                      }}
                    >
                      <PencilIcon className="size-3.5" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-muted-foreground hover:text-destructive"
                      disabled={locked(cycle) || deleteCycle.isPending}
                      title={lockReason(cycle) ?? `Delete ${cycle.name}`}
                      onClick={() => setDeleting(cycle)}
                    >
                      <Trash2Icon className="size-3.5" /> Delete
                    </Button>
                    {!cycle.started && (
                      <Button
                        size="sm"
                        className="gap-1.5 bg-role-hr text-role-hr-foreground hover:bg-role-hr/90"
                        disabled={startCycle.isPending || cycle.eligibleCount === 0}
                        onClick={() => startCycle.mutate(cycle.id)}
                      >
                        <PlayIcon className="size-3.5" /> Start
                      </Button>
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

      <Dialog open={needsTemplate} onOpenChange={setNeedsTemplate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create an appraisal template first</DialogTitle>
            <DialogDescription>
              Every cycle is run on a template — it holds the questions and rating scale each employee and
              manager answers. There is no active template yet, so there is nothing to build a cycle on.
              {canManageTemplates
                ? " Create one (or activate a draft), then come back to start the cycle."
                : " Ask an Admin or HR to create one, then come back to start the cycle."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            {canManageTemplates && (
              <Button className="gap-1.5" onClick={() => router.push("/appraisals/templates/new")}>
                <PlusIcon className="size-4" /> Create template
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription>
              {deleting?.started
                ? "Every appraisal in this cycle — self-appraisals, reviews, ratings and comments — is permanently deleted with it. This can't be undone."
                : deleting?.eligibleCount
                  ? `${deleting.eligibleCount} ${deleting.eligibleCount === 1 ? "employee is" : "employees are"} on this cycle's list. Nothing has been appraised yet, so nothing is lost — but the cycle and its list go.`
                  : "The cycle and its employee list will be removed."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              variant="destructive"
              disabled={deleteCycle.isPending}
              onClick={() =>
                deleting &&
                deleteCycle.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
              }
            >
              {deleteCycle.isPending ? "Deleting…" : "Delete cycle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CycleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        cycle={editingId ? editingCycle : undefined}
      />
    </div>
  )
}

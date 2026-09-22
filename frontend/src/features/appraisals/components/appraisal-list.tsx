"use client"

import { ClipboardListIcon } from "lucide-react"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { AppraisalStatusBadge } from "@/features/appraisals/components/appraisal-badges"
import { appraisalStatusMeta } from "@/features/appraisals/constants"
import type { AppraisalSummary } from "@/types/appraisals"

function formatScore(score: string | null) {
  if (score == null) return "—"
  return Number(score).toFixed(2)
}

/**
 * The one appraisal table, used by Employee Appraisals, My Appraisal and
 * Pending Reviews. `showEmployee` is off for My Appraisal, where every row is
 * the same person and the column would just be noise.
 */
export function AppraisalList({
  appraisals,
  isLoading,
  isError,
  onRetry,
  onOpen,
  showEmployee = true,
  emptyTitle = "No appraisals yet",
  emptyHint = "Appraisals appear here once a cycle has been started.",
}: {
  appraisals: AppraisalSummary[]
  isLoading: boolean
  isError?: boolean
  onRetry?: () => void
  onOpen: (id: string) => void
  showEmployee?: boolean
  emptyTitle?: string
  emptyHint?: string
}) {
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-xl border shadow-2xs">
        <div className="grid gap-px bg-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 bg-card p-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="ml-auto h-4 w-32" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="grid gap-3 rounded-xl border border-dashed p-10 text-center">
        <p className="text-sm font-semibold text-foreground">Couldn&apos;t load appraisals</p>
        <p className="text-xs text-muted-foreground">The request didn&apos;t reach the server.</p>
        {onRetry && (
          <div>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Try again
            </Button>
          </div>
        )}
      </div>
    )
  }

  if (!appraisals.length) {
    return (
      <div className="grid justify-items-center gap-2 rounded-xl border border-dashed p-12 text-center">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-role-hr/10 text-role-hr">
          <ClipboardListIcon className="size-5" />
        </span>
        <p className="text-sm font-semibold text-foreground">{emptyTitle}</p>
        <p className="max-w-sm text-xs text-muted-foreground">{emptyHint}</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden overflow-x-auto rounded-xl border shadow-2xs">
      <Table>
        <TableHeader>
          <TableRow>
            {showEmployee && <TableHead>Employee</TableHead>}
            <TableHead>Cycle</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden lg:table-cell">Waiting on</TableHead>
            <TableHead className="hidden md:table-cell">Version</TableHead>
            <TableHead>Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appraisals.map((appraisal) => {
            const meta = appraisalStatusMeta(appraisal.status)
            return (
              <TableRow key={appraisal.id} className="cursor-pointer" onClick={() => onOpen(appraisal.id)}>
                {showEmployee && (
                  <TableCell>
                    <p className="font-medium text-foreground">{appraisal.employeeName}</p>
                    <p className="text-xs text-muted-foreground">{appraisal.employeeCode}</p>
                  </TableCell>
                )}
                <TableCell className="text-muted-foreground">{appraisal.cycleName ?? "—"}</TableCell>
                <TableCell>
                  <AppraisalStatusBadge status={appraisal.status} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  <span className="first-letter:uppercase">{meta.owner ?? "—"}</span>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {appraisal.currentVersion ? (
                    <Badge variant="outline" className="font-mono">
                      V{appraisal.currentVersion}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="font-medium tabular-nums">
                  {formatScore(appraisal.effectiveScore)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

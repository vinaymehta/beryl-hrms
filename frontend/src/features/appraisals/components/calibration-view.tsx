"use client"

import { TriangleAlertIcon, ScaleIcon } from "lucide-react"
import { cn } from "cn"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { AppraisalStatusBadge } from "@/features/appraisals/components/appraisal-badges"
import { useCalibration } from "@/features/appraisals/hooks/use-appraisals"

function score(value: number | null) {
  return value == null ? "—" : value.toFixed(2)
}

/**
 * §16 Calibration dashboard. Self, manager, weighted and final ratings side by
 * side across the cohort, with unusual gaps flagged.
 *
 * Deliberately NOT a forced distribution: nothing here ranks, curves or caps
 * anyone. The scope is explicit that calibration exists "to improve
 * consistency, not force a predetermined rating distribution", so the
 * distribution strip below is reporting, not a target.
 */
export function CalibrationView({ cycleId, onOpen }: { cycleId: string; onOpen: (id: string) => void }) {
  const { data, isLoading } = useCalibration(cycleId)

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />
  if (!data) return null

  const { rows, summary } = data

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "In this cycle", value: summary.total },
          { label: "Flagged gaps", value: summary.flagged, warn: summary.flagged > 0 },
          { label: "Awaiting review", value: summary.awaitingReview },
          { label: "Released", value: summary.released },
        ].map((tile) => (
          <div key={tile.label} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-2xs">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                tile.warn ? "bg-warning/10 text-warning" : "bg-role-hr/10 text-role-hr"
              )}
            >
              {tile.warn ? <TriangleAlertIcon className="size-4" /> : <ScaleIcon className="size-4" />}
            </span>
            <div>
              <p className="text-xl leading-tight font-semibold tabular-nums">{tile.value}</p>
              <p className="text-xs text-muted-foreground">{tile.label}</p>
            </div>
          </div>
        ))}
      </div>

      {Object.keys(summary.distribution).length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 text-xs shadow-2xs">
          <span className="font-semibold text-muted-foreground">Final rating spread</span>
          {Object.entries(summary.distribution).map(([rating, count]) => (
            <Badge key={rating} variant="outline" className="tabular-nums">
              {rating} → {count}
            </Badge>
          ))}
          <span className="text-muted-foreground">Reporting only — no target distribution is applied.</span>
        </div>
      )}

      <div className="overflow-hidden overflow-x-auto rounded-xl border shadow-2xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead className="hidden lg:table-cell">Role</TableHead>
              <TableHead>Self</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Weighted</TableHead>
              <TableHead>Final</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.appraisalId}
                className={cn("cursor-pointer", row.flagged && "bg-warning/5")}
                onClick={() => onOpen(row.appraisalId)}
              >
                <TableCell>
                  <p className="font-medium text-foreground">{row.employeeName}</p>
                  <p className="text-xs text-muted-foreground">{row.employeeCode}</p>
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {row.designation ?? "—"}
                </TableCell>
                <TableCell className="tabular-nums">{score(row.selfRating)}</TableCell>
                <TableCell className="tabular-nums">
                  <span className="flex items-center gap-1.5">
                    {score(row.managerRating)}
                    {row.flagged && (
                      <Badge className="gap-1 bg-warning/15 text-warning">
                        <TriangleAlertIcon className="size-3" />
                        {row.gap! > 0 ? `+${row.gap}` : row.gap}
                      </Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell className="tabular-nums">{score(row.weightedScore)}</TableCell>
                <TableCell className="font-medium tabular-nums">
                  <span className="flex items-center gap-1.5">
                    {score(row.finalRating)}
                    {row.overridden && (
                      <Badge variant="outline" className="text-[10px]">
                        calibrated
                      </Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <AppraisalStatusBadge status={row.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

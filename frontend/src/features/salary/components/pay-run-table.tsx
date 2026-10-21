"use client"

import {
  DownloadIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  FilePlus2Icon,
  RefreshCcwIcon,
  SendIcon,
} from "lucide-react"
import { cn } from "cn"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { rupees } from "@/features/appraisals/salary-structure"
import { salaryApi } from "@/features/salary/api"
import { SlipStatusPill } from "@/features/salary/components/slip-status"
import { canSend, initials, rowAmounts, slipState } from "@/features/salary/pay-run"
import { API_ORIGIN } from "@/lib/api-client"
import type { SalaryEmployee } from "@/types/salary"

export interface RowActions {
  onGenerate: (row: SalaryEmployee) => void
  onView: (row: SalaryEmployee) => void
  onSend: (row: SalaryEmployee) => void
}

/**
 * The run's rows. From md up: employee, role, gross, net, status and actions;
 * on a phone the role and gross fold away and the status rides under the
 * name, so the table fits without scrolling sideways.
 *
 * Each row has one obvious next step as a button — Generate before there is
 * a slip, View after — and everything else in its ⋮ menu.
 */
export function PayRunTable({
  rows,
  sending,
  generating,
  selected,
  onToggle,
  onToggleAll,
  actions,
}: {
  rows: SalaryEmployee[]
  sending: ReadonlySet<number>
  /** Employee ids with a generate request in flight. */
  generating: ReadonlySet<number>
  selected: ReadonlySet<number>
  onToggle: (id: number, checked: boolean) => void
  onToggleAll: (checked: boolean) => void
  actions: RowActions
}) {
  const selectable = rows.filter((row) => row.eligible)
  // No "indeterminate" state: the shared Checkbox draws it as a tick, which
  // would read as "all selected" when only some are.
  const allSelected = selectable.length > 0 && selectable.every((row) => selected.has(row.id))

  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-2xs">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-10 pl-3">
              <Checkbox
                aria-label="Select every employee who can be paid"
                checked={allSelected}
                disabled={!selectable.length}
                onCheckedChange={(checked) => onToggleAll(checked)}
              />
            </TableHead>
            <TableHead>Employee</TableHead>
            <TableHead className="hidden lg:table-cell">Designation · Department</TableHead>
            <TableHead className="hidden text-right md:table-cell">Gross</TableHead>
            <TableHead className="text-right">Net</TableHead>
            <TableHead className="hidden sm:table-cell">Status</TableHead>
            <TableHead className="w-10 pr-3 text-right sm:w-auto">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const state = slipState(row, sending)
            const amounts = rowAmounts(row)
            const checked = selected.has(row.id)
            const busy = generating.has(row.id)
            const role = [row.designationTitle, row.departmentName].filter(Boolean).join(" · ")
            return (
              <TableRow
                key={row.id}
                data-state={checked ? "selected" : undefined}
                className={cn(!row.eligible && !row.slip && "text-muted-foreground")}
              >
                <TableCell className="pl-3">
                  <Checkbox
                    aria-label={`Select ${row.fullName}`}
                    checked={checked}
                    disabled={!row.eligible}
                    onCheckedChange={(next) => onToggle(row.id, next)}
                  />
                </TableCell>
                <TableCell className="w-full max-w-0 whitespace-normal sm:w-auto sm:max-w-72">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar size="sm" className="hidden size-8 sm:flex">
                      {row.profilePhotoUrl && <AvatarImage src={`${API_ORIGIN}${row.profilePhotoUrl}`} alt="" />}
                      <AvatarFallback className="bg-role-accounts/12 text-[11px] font-semibold text-role-accounts">
                        {initials(row.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className={cn("truncate font-medium", (row.eligible || row.slip) && "text-foreground")}>
                        {row.fullName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.employeeCode}
                        {role && <span className="lg:hidden"> · {role}</span>}
                      </p>
                      <SlipStatusPill row={row} state={state} className="mt-1 sm:hidden" />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden max-w-56 truncate text-muted-foreground lg:table-cell">
                  {role || "—"}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">
                  {amounts ? rupees.format(amounts.gross) : "—"}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {amounts ? <span className="text-foreground">{rupees.format(amounts.net)}</span> : "—"}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <SlipStatusPill row={row} state={state} className="max-w-60" />
                </TableCell>
                <TableCell className="pr-3">
                  <div className="flex items-center justify-end gap-1">
                    {row.slip ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="hidden gap-1 sm:inline-flex"
                        onClick={() => actions.onView(row)}
                      >
                        <EyeIcon /> View
                      </Button>
                    ) : row.eligible ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="hidden gap-1 border-role-accounts/30 text-role-accounts hover:bg-role-accounts/8 hover:text-role-accounts sm:inline-flex"
                        disabled={busy}
                        onClick={() => actions.onGenerate(row)}
                      >
                        <FilePlus2Icon /> {busy ? "Generating…" : "Generate"}
                      </Button>
                    ) : null}
                    <RowMenu row={row} busy={busy} actions={actions} />
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function RowMenu({ row, busy, actions }: { row: SalaryEmployee; busy: boolean; actions: RowActions }) {
  const slip = row.slip
  if (!slip && !row.eligible) return <span className="inline-block size-7" aria-hidden />

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.fullName}`}>
            <EllipsisVerticalIcon className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        {row.eligible && (
          <DropdownMenuItem disabled={busy} onClick={() => actions.onGenerate(row)}>
            {slip ? <RefreshCcwIcon className="size-4" /> : <FilePlus2Icon className="size-4" />}
            {slip ? "Regenerate" : "Generate"}
          </DropdownMenuItem>
        )}
        {slip && (
          <>
            <DropdownMenuItem onClick={() => actions.onView(row)}>
              <EyeIcon className="size-4" /> View slip
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<a href={salaryApi.pdfUrl(slip.id, { download: true, version: slip.generatedAt })} />}
            >
              <DownloadIcon className="size-4" /> Download PDF
            </DropdownMenuItem>
            {row.eligible && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => actions.onSend(row)}>
                  <SendIcon className="size-4" /> {canSend(row) ? "Send" : "Resend"}
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

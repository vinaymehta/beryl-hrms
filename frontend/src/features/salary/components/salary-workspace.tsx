"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  BanknoteIcon,
  FilePlus2Icon,
  FileStackIcon,
  SearchIcon,
  SendIcon,
  SparklesIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useCurrentUser } from "@/features/auth/hooks/use-current-user"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { NeedsAttention } from "@/features/salary/components/needs-attention"
import { PayRunSummary } from "@/features/salary/components/pay-run-summary"
import { PayRunTable } from "@/features/salary/components/pay-run-table"
import { SlipSheet } from "@/features/salary/components/slip-sheet"
import { useGenerateSalarySlips, useSalaryRun, useSendSalarySlips } from "@/features/salary/hooks/use-salary"
import {
  canGenerate,
  canSend,
  matchesFilter,
  matchesSearch,
  monthOptions,
  plural,
  shortDate,
  type RunFilter,
} from "@/features/salary/pay-run"
import { PERMISSIONS } from "@/constants/permissions"
import type { SalaryEmployee } from "@/types/salary"

const FILTERS: { id: RunFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Not generated" },
  { id: "generated", label: "Generated" },
  { id: "sent", label: "Sent" },
  { id: "attention", label: "Needs attention" },
]

/** How long a queued slip shows "Sending…" (and the run is re-read) at most. */
const SENDING_WINDOW_MS = 60_000

/** What the confirm dialog is asking about, if anything. */
type Confirm =
  | { kind: "send"; rows: SalaryEmployee[]; resend: boolean }
  | { kind: "regenerate"; rows: SalaryEmployee[] }
  | null

/**
 * The Salary page — each month a pay run, worked in three steps:
 *
 *   Generate  each employee's slip is rendered and stored (SalarySlip)
 *   Review    open any slip in the side panel, exactly as it will be mailed
 *   Send      the stored PDFs are emailed, one background job each
 *
 * The amounts are the salary on file from each employee's latest released
 * appraisal. Anyone without one, or without an email address, can't be in
 * the run; the "Needs attention" panel lists them with a link to fix it.
 */
export function SalaryWorkspace() {
  const router = useRouter()
  const { user, isLoading: isUserLoading } = useCurrentUser()
  const canUse = usePermission(PERMISSIONS.salarySend)
  const forbidden = !isUserLoading && !!user && !canUse

  useEffect(() => {
    if (forbidden) router.replace("/")
  }, [forbidden, router])

  // Default: last month — slips go out once a month has been worked.
  const months = useMemo(() => monthOptions(new Date()), [])
  const [month, setMonth] = useState(months[1].value)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<RunFilter>("all")
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [viewingId, setViewingId] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  // Slip ids queued for email. The job marks each sent within moments; until
  // the run shows that, the row reads "Sending…" and the run is re-read.
  const [queued, setQueued] = useState<Set<number>>(new Set())
  const [generatingIds, setGeneratingIds] = useState<Set<number>>(new Set())

  const { data, isLoading, isError, refetch } = useSalaryRun(month, {
    enabled: canUse,
    polling: queued.size > 0,
  })
  const generateSlips = useGenerateSalarySlips(month)
  const sendSlips = useSendSalarySlips(month)

  const rows = useMemo(() => data?.employees ?? [], [data])
  const sending = useMemo(
    () => new Set(rows.flatMap((row) => (row.slip && row.slip.status !== "sent" && queued.has(row.slip.id) ? [row.slip.id] : []))),
    [rows, queued]
  )
  const query = search.trim().toLowerCase()
  const visible = useMemo(
    () => rows.filter((row) => matchesFilter(row, filter) && matchesSearch(row, query)),
    [rows, filter, query]
  )
  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map(({ id }) => [id, rows.filter((row) => matchesFilter(row, id)).length])),
    [rows]
  ) as Record<RunFilter, number>

  if (forbidden) return null

  const period = months.find((option) => option.value === month)?.label ?? month
  const summary = data?.summary
  const payable = rows.filter((row) => row.eligible || row.slip).length
  const generated = rows.filter((row) => row.slip).length
  const sent = rows.filter((row) => row.slip?.status === "sent").length
  const pending = rows.filter((row) => row.eligible && !row.slip)
  const ready = rows.filter((row) => canSend(row) && !sending.has(row.slip!.id))

  const selectedRows = rows.filter((row) => selected.has(row.id))
  const bulkGenerate = selectedRows.filter(canGenerate)
  const bulkSend = selectedRows.filter((row) => canSend(row) && !sending.has(row.slip!.id))
  // The panel steps through the slips the table is showing.
  const viewable = visible.filter((row) => row.slip)
  const viewing = rows.find((row) => row.id === viewingId) ?? null

  const runStatus =
    generated === 0
      ? { label: "Draft", className: "bg-muted text-muted-foreground" }
      : sent === 0
        ? { label: "In review", className: "bg-info/12 text-info" }
        : sent < payable
          ? { label: "Partly sent", className: "bg-warning/15 text-warning" }
          : { label: "Completed", className: "bg-success/15 text-success" }

  function changeMonth(next: string) {
    setMonth(next)
    setSelected(new Set())
    setViewingId(null)
  }

  function toggle(id: number, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleAll(checked: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      for (const row of visible.filter((candidate) => candidate.eligible)) {
        if (checked) next.add(row.id)
        else next.delete(row.id)
      }
      return next
    })
  }

  function setGenerating(ids: number[], on: boolean) {
    setGeneratingIds((current) => {
      const next = new Set(current)
      for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  /** A sent slip is only replaced after the regenerate confirm. */
  function generate(targets: SalaryEmployee[], regenerate = false) {
    if (!targets.length) return
    if (!regenerate && targets.some((row) => row.slip?.status === "sent")) {
      setConfirm({ kind: "regenerate", rows: targets })
      return
    }

    const ids = targets.map((row) => row.id)
    setGenerating(ids, true)
    generateSlips.mutate(
      { employeeIds: ids, regenerate },
      {
        onSuccess: (batch) => {
          setConfirm(null)
          const done = batch.results.filter((result) => result.status === "generated")
          const skipped = batch.results.filter((result) => result.status === "skipped")
          if (done.length) {
            toast.success(`${plural(done.length, "salary slip", "salary slips")} generated for ${period}.`, {
              description: batch.notice ?? "Open a slip to review it before sending.",
            })
          }
          if (skipped.length) {
            toast.warning(`${plural(skipped.length, "employee", "employees")} skipped`, {
              description: skipped.map((result) => `${result.fullName}: ${result.reason}`).join("\n"),
            })
          }
        },
        onSettled: () => setGenerating(ids, false),
      }
    )
  }

  function requestSend(targets: SalaryEmployee[]) {
    if (!targets.length) return
    setConfirm({ kind: "send", rows: targets, resend: targets.some((row) => row.slip?.status === "sent") })
  }

  function send(targets: SalaryEmployee[], resend: boolean) {
    sendSlips.mutate(
      { slipIds: targets.map((row) => row.slip!.id), resend },
      {
        onSuccess: (batch) => {
          setConfirm(null)
          const queuedNow = batch.results.filter((result) => result.status === "queued")
          const skipped = batch.results.filter((result) => result.status === "skipped")
          const queuedIds = queuedNow.map((result) => result.slipId)
          setQueued((current) => new Set([...current, ...queuedIds]))
          setTimeout(() => {
            setQueued((current) => new Set([...current].filter((id) => !queuedIds.includes(id))))
          }, SENDING_WINDOW_MS)
          // Sent rows leave the selection; skipped ones stay picked, so fixing
          // the reason and sending again is one click.
          const queuedEmployees = new Set(queuedNow.map((result) => result.employeeId))
          setSelected((current) => new Set([...current].filter((id) => !queuedEmployees.has(id))))

          if (queuedNow.length) {
            toast.success(`${plural(queuedNow.length, "salary slip", "salary slips")} on the way for ${period}.`, {
              description: "Each is emailed as a PDF within moments; the row turns Sent once it has gone.",
            })
          }
          if (skipped.length) {
            toast.warning(`${plural(skipped.length, "slip", "slips")} not sent`, {
              description: skipped.map((result) => `${result.fullName}: ${result.reason}`).join("\n"),
            })
          }
        },
      }
    )
  }

  const rowActions = {
    onGenerate: (row: SalaryEmployee) => generate([row]),
    onView: (row: SalaryEmployee) => setViewingId(row.id),
    onSend: (row: SalaryEmployee) => requestSend([row]),
  }

  const loading = isLoading || isUserLoading

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-role-accounts/12 text-role-accounts">
            <BanknoteIcon className="size-5.5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Salary</h1>
              {data && (
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", runStatus.className)}>
                  {runStatus.label}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Pay run for {period} — generate each slip, review it, then email it to the employee.
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Select items={months} value={month} onValueChange={(next) => next && changeMonth(next)}>
            <SelectTrigger aria-label="Pay run month" className="h-9 flex-1 sm:w-44 sm:flex-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pending.length > 0 ? (
            <Button
              size="lg"
              className="gap-1.5 bg-role-accounts text-role-accounts-foreground shadow-sm hover:bg-role-accounts/90"
              disabled={generateSlips.isPending}
              onClick={() => generate(pending)}
            >
              <FilePlus2Icon className="size-4" />
              Generate {plural(pending.length, "slip", "slips")}
            </Button>
          ) : ready.length > 0 ? (
            <Button
              size="lg"
              className="gap-1.5 bg-role-accounts text-role-accounts-foreground shadow-sm hover:bg-role-accounts/90"
              onClick={() => requestSend(ready)}
            >
              <SendIcon className="size-4" />
              Send {plural(ready.length, "slip", "slips")}
            </Button>
          ) : null}
        </div>
      </div>

      {!isError && <PayRunSummary summary={summary} isLoading={loading} />}

      {loading ? (
        <TableSkeleton />
      ) : isError ? (
        <div className="grid gap-3 rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm font-semibold text-foreground">Couldn&apos;t load the pay run</p>
          <p className="text-xs text-muted-foreground">
            The request didn&apos;t reach the server. Check your connection and try again.
          </p>
          <div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        </div>
      ) : !rows.length ? (
        <EmptyState
          icon={UsersIcon}
          title="No active employees"
          description="Add employees first — each active employee is part of the monthly pay run."
        />
      ) : payable === 0 ? (
        <>
          <EmptyState
            icon={BanknoteIcon}
            title="No salaries on file yet"
            description={
              <>
                A slip prints the salary from the employee&apos;s latest released appraisal. Release an appraisal with
                a compensation breakdown — or fix the gaps below — and they join the run.
              </>
            }
            action={
              <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/appraisals" />}>
                Go to appraisals
              </Button>
            }
          />
          <NeedsAttention rows={rows} />
        </>
      ) : (
        <>
          <NeedsAttention rows={rows} />

          {generated === 0 && (
            <div className="flex flex-col items-start gap-4 overflow-hidden rounded-xl border border-role-accounts/20 bg-linear-to-br from-role-accounts/10 via-role-accounts/4 to-transparent p-5 sm:flex-row sm:items-center">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-role-accounts text-role-accounts-foreground shadow-sm">
                <SparklesIcon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Start the {period} pay run</p>
                <p className="text-xs text-muted-foreground">
                  Nothing is generated yet. Generate the slips, check each one, then send — nothing is emailed until
                  you press Send.
                </p>
              </div>
              <Button
                className="gap-1.5 bg-role-accounts text-role-accounts-foreground hover:bg-role-accounts/90"
                disabled={generateSlips.isPending}
                onClick={() => generate(pending)}
              >
                <FilePlus2Icon className="size-4" />
                Generate slips for all {plural(pending.length, "eligible employee", "eligible employees")}
              </Button>
            </div>
          )}

          <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div
                role="tablist"
                aria-label="Filter by status"
                className="flex w-full gap-0.5 overflow-x-auto rounded-lg border bg-muted/50 p-0.5 lg:w-fit"
              >
                {FILTERS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === option.id}
                    onClick={() => setFilter(option.id)}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs whitespace-nowrap transition-colors",
                      filter === option.id
                        ? "bg-background font-medium text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {option.label}
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-[10px] tabular-nums",
                        filter === option.id ? "bg-role-accounts/12 text-role-accounts" : "bg-muted"
                      )}
                    >
                      {counts[option.id]}
                    </span>
                  </button>
                ))}
              </div>
              <div className="relative w-full lg:max-w-72">
                <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 pl-8 text-xs"
                  aria-label="Search employees"
                  placeholder="Search name, ID, designation…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {visible.length ? (
              <PayRunTable
                rows={visible}
                sending={sending}
                generating={generatingIds}
                selected={selected}
                onToggle={toggle}
                onToggleAll={toggleAll}
                actions={rowActions}
              />
            ) : (
              <EmptyState
                icon={FileStackIcon}
                title={query ? "No employees match this search" : "Nobody here"}
                description={
                  query ? "Try another name, ID or designation." : "No employee in this run is at this stage."
                }
              />
            )}
          </div>
        </>
      )}

      {/* Bulk actions — pinned to the bottom of the scrolling page while rows are picked. */}
      {selected.size > 0 && (
        <div className="sticky bottom-2 z-20 mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-2 rounded-xl border bg-popover/95 px-3 py-2 shadow-lg backdrop-blur supports-backdrop-filter:bg-popover/80">
          <p className="text-sm font-medium">{selected.size} selected</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={!bulkGenerate.length || generateSlips.isPending}
              onClick={() => generate(bulkGenerate)}
            >
              <FilePlus2Icon /> Generate {plural(bulkGenerate.length, "slip", "slips")}
            </Button>
            <Button
              size="sm"
              className="gap-1 bg-role-accounts text-role-accounts-foreground hover:bg-role-accounts/90"
              disabled={!bulkSend.length}
              onClick={() => requestSend(bulkSend)}
            >
              <SendIcon /> Send {plural(bulkSend.length, "slip", "slips")}
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Clear selection" onClick={() => setSelected(new Set())}>
              <XIcon className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <SlipSheet
        rows={viewable}
        current={viewing}
        onNavigate={(row) => setViewingId(row.id)}
        onClose={() => setViewingId(null)}
        period={period}
        sending={sending}
        generating={!!viewing && generatingIds.has(viewing.id)}
        onGenerate={(row) => generate([row])}
        onSend={(row) => requestSend([row])}
      />

      <ConfirmDialog
        confirm={confirm}
        period={period}
        busy={generateSlips.isPending || sendSlips.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.kind === "send") send(confirm.rows, confirm.resend)
          else if (confirm?.kind === "regenerate") generate(confirm.rows, true)
        }}
      />
    </div>
  )
}

function ConfirmDialog({
  confirm,
  period,
  busy,
  onCancel,
  onConfirm,
}: {
  confirm: Confirm
  period: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const rows = confirm?.rows ?? []
  const one = rows.length === 1 ? rows[0] : null
  const sentRows = rows.filter((row) => row.slip?.status === "sent")

  let title = ""
  let description: ReactNode = null
  let action = ""
  if (confirm?.kind === "send") {
    title = one
      ? `${confirm.resend ? "Resend" : "Send"} ${one.fullName}'s salary slip for ${period}?`
      : `Send ${plural(rows.length, "salary slip", "salary slips")} for ${period}?`
    description = one ? (
      <>
        The slip you reviewed is emailed as a PDF to <span className="font-medium text-foreground">{one.recipientEmail}</span>.
        {one.slip?.sentAt && <> It was already sent on {shortDate(one.slip.sentAt)}.</>}
      </>
    ) : (
      <>
        Each employee is emailed their own slip as a PDF — the one stored when it was generated — at their work email,
        or their personal one if they have no login.
        {sentRows.length > 0 && <> {plural(sentRows.length, "slip was", "slips were")} already sent and will go again.</>}
      </>
    )
    action = busy ? "Sending…" : one ? (confirm.resend ? "Resend slip" : "Send slip") : `Send ${plural(rows.length, "slip", "slips")}`
  } else if (confirm?.kind === "regenerate") {
    title = one
      ? `Regenerate ${one.fullName}'s slip?`
      : `Regenerate ${plural(rows.length, "slip", "slips")} for ${period}?`
    description = (
      <>
        {sentRows.length === 1 && one
          ? `It was emailed on ${one.slip?.sentAt ? shortDate(one.slip.sentAt) : "an earlier date"}.`
          : `${plural(sentRows.length, "slip has", "slips have")} already been emailed.`}{" "}
        The new PDF replaces the old one and the slip goes back to Generated — send it again so the employee gets the
        new version.
      </>
    )
    action = busy ? "Regenerating…" : "Regenerate"
  }

  return (
    <Dialog open={!!confirm} onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} disabled={busy} />
          <Button
            disabled={busy}
            className="bg-role-accounts text-role-accounts-foreground hover:bg-role-accounts/90"
            onClick={onConfirm}
          >
            {action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof UsersIcon
  title: string
  description: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="grid justify-items-center gap-2 rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-role-accounts/10 text-role-accounts">
        <Icon className="size-5.5" />
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-md text-xs text-muted-foreground">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border shadow-2xs">
      <div className="grid gap-px bg-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 bg-card p-3">
            <Skeleton className="size-4 shrink-0 rounded" />
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto h-4 w-24" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

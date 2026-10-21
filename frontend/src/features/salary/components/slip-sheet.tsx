"use client"

import Link from "next/link"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  MailIcon,
  RefreshCcwIcon,
  SendIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { PdfPages } from "@/components/ui/pdf-pages"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { rupees } from "@/features/appraisals/salary-structure"
import { salaryApi } from "@/features/salary/api"
import { SlipStatusPill } from "@/features/salary/components/slip-status"
import { canSend, dateTime, isBlocking, slipState } from "@/features/salary/pay-run"
import type { SalaryEmployee } from "@/types/salary"

/**
 * One employee's generated slip, for review: the stored PDF drawn page by
 * page (PdfPages — no browser viewer around it) beside what it adds up to,
 * who it goes to and where it stands, with Download, Regenerate and Send.
 *
 * `rows` are the slips the table is showing, so ‹ › step through them in the
 * table's order without closing the panel.
 */
export function SlipSheet({
  rows,
  current,
  onNavigate,
  onClose,
  period,
  sending,
  generating,
  onGenerate,
  onSend,
}: {
  rows: SalaryEmployee[]
  current: SalaryEmployee | null
  onNavigate: (row: SalaryEmployee) => void
  onClose: () => void
  period: string
  sending: ReadonlySet<number>
  generating: boolean
  onGenerate: (row: SalaryEmployee) => void
  onSend: (row: SalaryEmployee) => void
}) {
  const index = current ? rows.findIndex((row) => row.id === current.id) : -1
  const previous = index > 0 ? rows[index - 1] : null
  const next = index >= 0 && index < rows.length - 1 ? rows[index + 1] : null
  const slip = current?.slip

  return (
    <Sheet open={!!current && !!slip} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[min(1120px,calc(100vw-16rem))]">
        {current && slip && (
          <>
            <SheetHeader className="shrink-0 flex-row items-center gap-3 border-b bg-background px-5 py-3.5 pr-14">
              <span className="hidden size-10 shrink-0 items-center justify-center rounded-lg bg-role-accounts/12 text-role-accounts sm:flex">
                <FileTextIcon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <SheetTitle className="truncate text-base leading-tight font-semibold">{current.fullName}</SheetTitle>
                <SheetDescription className="mt-0.5 truncate text-xs">
                  Salary slip · {period} · {current.employeeCode}
                </SheetDescription>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="mr-1 hidden text-xs text-muted-foreground tabular-nums md:inline">
                  {index + 1} of {rows.length}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Previous slip"
                  disabled={!previous}
                  onClick={() => previous && onNavigate(previous)}
                >
                  <ChevronLeftIcon className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Next slip"
                  disabled={!next}
                  onClick={() => next && onNavigate(next)}
                >
                  <ChevronRightIcon className="size-4" />
                </Button>
              </div>
            </SheetHeader>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
              {/* The slip as it was stored — and as it will be mailed. */}
              <div className="order-2 bg-muted/50 p-3 sm:p-5 lg:order-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                <div className="mx-auto w-fit max-w-full overflow-hidden rounded-md shadow-md ring-1 ring-foreground/10">
                  <PdfPages
                    key={`${slip.id}:${slip.generatedAt}`}
                    src={salaryApi.pdfUrl(slip.id, { version: slip.generatedAt })}
                  />
                </div>
              </div>

              <aside className="order-1 grid shrink-0 content-start gap-4 border-b bg-background p-5 lg:order-2 lg:w-80 lg:overflow-y-auto lg:border-b-0 lg:border-l">
                <SlipStatusPill row={current} state={slipState(current, sending)} className="w-fit" />

                <div className="overflow-hidden rounded-xl border">
                  <div className="bg-role-accounts/8 px-4 py-3">
                    <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Net pay</p>
                    <p className="text-2xl font-bold text-foreground tabular-nums">{rupees.format(slip.net)}</p>
                  </div>
                  <dl className="grid gap-2 px-4 py-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Gross pay</dt>
                      <dd className="font-medium tabular-nums">{rupees.format(slip.gross)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Deductions</dt>
                      <dd className="font-medium tabular-nums">− {rupees.format(slip.deductions)}</dd>
                    </div>
                  </dl>
                </div>

                {slip.outdated && (
                  <p className="flex gap-2 rounded-lg bg-info/10 px-3 py-2 text-xs text-info">
                    <RefreshCcwIcon className="mt-px size-3.5 shrink-0" />
                    The salary on file has changed since this slip was generated. Regenerate it to use the new figures.
                  </p>
                )}

                <dl className="grid gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Sends to</dt>
                    <dd className="mt-0.5 flex items-center gap-1.5 font-medium break-all">
                      <MailIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      {current.recipientEmail ?? <span className="text-destructive">No email address on file</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Generated</dt>
                    <dd className="mt-0.5">{dateTime(slip.generatedAt)}</dd>
                  </div>
                  {slip.sentAt && (
                    <div>
                      <dt className="text-xs text-muted-foreground">Sent</dt>
                      <dd className="mt-0.5">
                        {dateTime(slip.sentAt)}
                        {slip.sentTo && <span className="block text-xs break-all text-muted-foreground">to {slip.sentTo}</span>}
                      </dd>
                    </div>
                  )}
                </dl>

                {current.issues.length > 0 && (
                  <div className="grid gap-1.5 rounded-lg border border-warning/30 bg-warning/6 p-3">
                    {current.issues.map((issue) => (
                      <p
                        key={issue}
                        className={
                          isBlocking(issue)
                            ? "flex items-center gap-1.5 text-xs text-destructive"
                            : "flex items-center gap-1.5 text-xs text-warning"
                        }
                      >
                        <TriangleAlertIcon className="size-3.5 shrink-0" /> {issue}
                      </p>
                    ))}
                    <Link
                      href={`/employees/${current.id}`}
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      Open employee profile <ExternalLinkIcon className="size-3" />
                    </Link>
                  </div>
                )}

                <div className="grid gap-2 pt-1">
                  {current.eligible && (
                    <Button
                      className="w-full gap-1.5 bg-role-accounts text-role-accounts-foreground hover:bg-role-accounts/90"
                      disabled={slipState(current, sending) === "sending"}
                      onClick={() => onSend(current)}
                    >
                      <SendIcon className="size-4" /> {canSend(current) ? "Send slip" : "Resend slip"}
                    </Button>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="gap-1.5"
                      // A real anchor: the PDF is a streamed download, not a JSON call.
                      nativeButton={false}
                      render={<a href={salaryApi.pdfUrl(slip.id, { download: true, version: slip.generatedAt })} />}
                    >
                      <DownloadIcon className="size-4" /> Download
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-1.5"
                      disabled={!current.eligible || generating}
                      onClick={() => onGenerate(current)}
                    >
                      <RefreshCcwIcon className="size-4" /> {generating ? "Working…" : "Regenerate"}
                    </Button>
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

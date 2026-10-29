"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { mailApi } from "@/features/mail/api"
import { useMailScanRun, useResumeMutations } from "../hooks"
import { DateRangePills } from "./date-range-pills"
import type { DateRangePreset } from "../lib/date-range-presets"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import { PanelBody, PanelFooter, PanelHeader } from "@/components/ui/panel"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import {
  MailSearchIcon,
  Loader2Icon,
  CheckCircle2Icon,
  ShieldCheckIcon,
  LockIcon,
  SettingsIcon,
  ArrowRightIcon,
  XCircleIcon,
} from "lucide-react"
import { cn } from "cn"
import { errorMessage } from "@/lib/errors"
import type { MailScanAccount } from "@/types/recruitment"

interface ScanZohoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}



export function ScanZohoModal({ open, onOpenChange }: ScanZohoModalProps) {
  const { data: connections, isLoading: connectionsLoading } = useQuery({
    queryKey: ["mail", "connections"],
    queryFn: mailApi.connections.list,
    enabled: open,
  })

  // null until the user changes the selection — meaning "every active
  // account", so the default also covers accounts that load or reconnect
  // after the panel first renders.
  const [pickedIds, setPickedIds] = useState<string[] | null>(null)
  const [scanId, setScanId] = useState<string | null>(null)
  const [datePreset, setDatePreset] = useState<DateRangePreset | "">("")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [resolvedRange, setResolvedRange] = useState<{ from: string; to: string } | null>(null)
  const { scanZohoMail } = useResumeMutations()
  const { data: scanRun } = useMailScanRun(scanId)

  const activeConnections = (connections ?? []).filter((c) => c.status === "active")
  const activeIds = activeConnections.map((c) => c.id)
  const selectedIds = (pickedIds ?? activeIds).filter((id) => activeIds.includes(id))
  const allSelected = activeIds.length > 0 && selectedIds.length === activeIds.length
  const scanning = scanZohoMail.isPending || (!!scanRun && !scanRun.finished)

  const toggleConnection = (id: string, checked: boolean) => {
    setPickedIds(checked ? [...selectedIds, id] : selectedIds.filter((s) => s !== id))
  }

  // One toast per run, when its last mailbox finishes.
  const announcedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!scanRun?.finished || announcedRef.current === scanRun.scanId) return
    announcedRef.current = scanRun.scanId

    const totals = sumAccounts(scanRun.accounts)
    const failed = scanRun.accounts.filter((a) => a.status === "failed")
    const skippedParts: string[] = []
    if (totals.skippedDuplicateAttachments > 0) skippedParts.push(`${totals.skippedDuplicateAttachments} already-imported`)
    if (totals.skippedNonResumeAttachments > 0) skippedParts.push(`${totals.skippedNonResumeAttachments} non-resume`)
    const skippedSuffix = skippedParts.length > 0 ? ` Skipped ${skippedParts.join(" and ")} attachment(s).` : ""

    if (failed.length === scanRun.accounts.length) {
      toast.error("Scan failed for every selected account.")
    } else if (failed.length > 0) {
      toast.warning(
        `Found ${totals.detectedResumes} new resume(s), but ${failed.length} account(s) couldn't be scanned.${skippedSuffix}`
      )
    } else {
      toast.success(`Scan complete! Found ${totals.detectedResumes} new resume(s).${skippedSuffix}`)
    }
  }, [scanRun])

  const handleScan = async () => {
    if (selectedIds.length === 0) {
      toast.error("Please select at least one mail account to scan")
      return
    }
    if (!resolvedRange) {
      toast.error("Please select a date range to scan")
      return
    }

    try {
      const run = await scanZohoMail.mutateAsync({ connectionIds: selectedIds, ...resolvedRange })
      setScanId(run.scanId)
    } catch (err) {
      toast.error(errorMessage(err, "Failed to start the scan"))
    }
  }

  // A run still in progress is kept, so reopening the panel shows where it
  // got to; the scans themselves carry on in the background either way.
  const handleClose = () => {
    if (scanRun?.finished) setScanId(null)
    onOpenChange(false)
  }

  const resetDateRange = () => {
    setDatePreset("")
    setCustomFrom("")
    setCustomTo("")
    setResolvedRange(null)
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:w-[45vw] sm:min-w-180 sm:max-w-275 flex flex-col p-0 gap-0 overflow-hidden">
        <PanelHeader
          icon={MailSearchIcon}
          title="Scan mail"
          description="Detect and import resumes from recent inbox attachments."
        />

        <PanelBody>
          {/* What to scan — the mail accounts and the date range, always shown. */}
          <div className="space-y-3 rounded-lg border bg-card p-4">
            {/* The shared panel label strip (see ui/panel.tsx), drawn edge to edge. */}
            <div className="-mx-4 -mt-4 flex items-center justify-between gap-2 border-b px-4 py-3">
              <div className="min-w-0">
                <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">What to Scan</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Choose the mail accounts and the time period to look for resumes.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-foreground">Mail accounts</p>
                  <Link
                    href="/settings/mail"
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-role-recruitment hover:underline"
                  >
                    <SettingsIcon className="size-3.5" />
                    Manage Connections
                  </Link>
                </div>
              {connectionsLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2Icon className="size-3.5 animate-spin" /> Loading mailboxes...
                </div>
              ) : !connections?.length ? (
                <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                  No Zoho Mail accounts connected yet. Add one under Settings → Mail.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {activeConnections.length > 1 && (
                    <label className="flex items-center gap-2 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      <Checkbox
                        checked={allSelected}
                        indeterminate={!allSelected && selectedIds.length > 0}
                        disabled={scanning}
                        onCheckedChange={(checked) => setPickedIds(checked ? activeIds : [])}
                      />
                      All accounts ({activeConnections.length})
                    </label>
                  )}
                  {connections.map((conn) => {
                    const isActive = conn.status === "active"
                    const checked = selectedIds.includes(conn.id)
                    return (
                      <label
                        key={conn.id}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-lg border bg-background p-2.5 text-xs transition-colors",
                          !isActive
                            ? "cursor-not-allowed opacity-60"
                            : checked
                              ? "cursor-pointer border-role-recruitment ring-1 ring-role-recruitment/30"
                              : "cursor-pointer hover:bg-muted/50"
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Checkbox
                            checked={checked}
                            disabled={!isActive || scanning}
                            onCheckedChange={(next) => toggleConnection(conn.id, next === true)}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{conn.emailAddress}</p>
                            <p className="text-[11px] text-muted-foreground capitalize">
                              {conn.connectionType.replace("_", " ")} mailbox
                            </p>
                          </div>
                        </div>
                        {isActive ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                            Needs reconnect
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
              )}
                <p className="text-[11px] text-muted-foreground">
                  Each selected account is scanned at the same time. A resume that reached more than one account is
                  imported once.
                </p>
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-foreground">Date range</p>
                {resolvedRange && (
                  <Button type="button" variant="outline" size="sm" onClick={resetDateRange} className="h-7 rounded-full text-xs">
                    Reset
                  </Button>
                )}
              </div>
              <DateRangePills
                preset={datePreset}
                customFrom={customFrom}
                customTo={customTo}
                onChange={({ preset, customFrom: f, customTo: t, resolved }) => {
                  setDatePreset(preset)
                  setCustomFrom(f)
                  setCustomTo(t)
                  setResolvedRange(resolved)
                }}
              />
              <p className="text-[11px] text-muted-foreground">
                Only messages received in this window are scanned — the mailbox isn&apos;t scanned outside it.
              </p>
            </div>
          </div>

          {scanRun && <ScanProgress accounts={scanRun.accounts} finished={scanRun.finished} />}

          <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-role-recruitment/10 text-role-recruitment">
              <ShieldCheckIcon className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Safe & Gated Scanning</p>
              <p className="text-xs text-muted-foreground">
                Only authorized mailboxes you have permission to access are scanned. Extracted resumes are routed
                directly into your company&apos;s isolated recruitment pipeline.
              </p>
            </div>
          </div>
        </PanelBody>

        <PanelFooter className="justify-between">
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <LockIcon className="size-3" />
            We don&apos;t read or store your emails. We only process attachments to extract resumes.
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={scanZohoMail.isPending}>
              Close
            </Button>
            <Button
              onClick={handleScan}
              disabled={selectedIds.length === 0 || !resolvedRange || scanning}
              className="gap-1.5 bg-gradient-to-r from-role-recruitment to-fuchsia-700 text-role-recruitment-foreground hover:opacity-90"
            >
              {scanning ? (
                <>
                  <Loader2Icon className="size-3.5 animate-spin" />
                  {selectedIds.length > 1 ? "Scanning Accounts..." : "Scanning Mailbox..."}
                </>
              ) : (
                <>
                  <MailSearchIcon className="size-3.5" />
                  Start Scanning
                  <ArrowRightIcon className="size-3.5" />
                </>
              )}
            </Button>
          </div>
        </PanelFooter>
      </SheetContent>
    </Sheet>
  )
}

function sumAccounts(accounts: MailScanAccount[]) {
  return accounts.reduce(
    (sum, a) => ({
      scannedMessages: sum.scannedMessages + (a.scannedMessages ?? 0),
      detectedResumes: sum.detectedResumes + (a.detectedResumes ?? 0),
      skippedDuplicateAttachments: sum.skippedDuplicateAttachments + (a.skippedDuplicateAttachments ?? 0),
      skippedNonResumeAttachments: sum.skippedNonResumeAttachments + (a.skippedNonResumeAttachments ?? 0),
    }),
    { scannedMessages: 0, detectedResumes: 0, skippedDuplicateAttachments: 0, skippedNonResumeAttachments: 0 }
  )
}

const ACCOUNT_STATUS_LABEL: Record<MailScanAccount["status"], string> = {
  queued: "Queued",
  waiting: "Waiting for another scan of this account",
  running: "Scanning",
  completed: "Done",
  failed: "Failed",
}

/** Per-account progress while the scans run, then the combined totals. */
function ScanProgress({ accounts, finished }: { accounts: MailScanAccount[]; finished: boolean }) {
  const totals = sumAccounts(accounts)

  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border p-3 text-xs",
        finished ? "border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20" : "bg-card"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 font-medium",
          finished ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"
        )}
      >
        {finished ? <CheckCircle2Icon className="size-4" /> : <Loader2Icon className="size-4 animate-spin" />}
        <span>{finished ? "Scan Completed" : "Scanning…"}</span>
      </div>

      <ul className="space-y-1 pl-5.5">
        {accounts.map((a) => (
          <li key={a.connectionId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
            <span className="min-w-0 truncate font-medium text-foreground">{a.emailAddress}</span>
            {a.status === "completed" ? (
              <span className="text-muted-foreground">
                {a.scannedMessages ?? 0} messages · {a.detectedResumes ?? 0} new resume(s)
              </span>
            ) : a.status === "failed" ? (
              <span className="inline-flex items-center gap-1 text-destructive">
                <XCircleIcon className="size-3.5" />
                {a.error || ACCOUNT_STATUS_LABEL.failed}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Loader2Icon className="size-3 animate-spin" />
                {ACCOUNT_STATUS_LABEL[a.status]}
              </span>
            )}
          </li>
        ))}
      </ul>

      {finished && (
        <>
          <p className="text-muted-foreground pl-5.5">
            Analyzed <strong>{totals.scannedMessages}</strong> messages. Identified and queued{" "}
            <strong className="text-emerald-600 dark:text-emerald-400">{totals.detectedResumes}</strong> resumes for AI
            processing.
          </p>
          {(totals.skippedDuplicateAttachments > 0 || totals.skippedNonResumeAttachments > 0) && (
            <p className="text-muted-foreground pl-5.5">
              Skipped {totals.skippedDuplicateAttachments} already-imported and {totals.skippedNonResumeAttachments}{" "}
              non-resume attachment(s).
            </p>
          )}
          <p className="text-[11px] text-muted-foreground/80 pl-5.5">
            Duplicates and unreadable resumes are flagged after AI processing completes — check the Duplicate and Needs
            Attention filters in the Resumes list shortly. Attachments that turn out not to be resumes are dropped.
          </p>
        </>
      )}
    </div>
  )
}

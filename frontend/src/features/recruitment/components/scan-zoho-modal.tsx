"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { mailApi } from "@/features/mail/api"
import { useResumeMutations } from "../hooks"
import { DateRangePills } from "./date-range-pills"
import type { DateRangePreset } from "../lib/date-range-presets"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  MailSearchIcon,
  Loader2Icon,
  CheckCircle2Icon,
  ShieldCheckIcon,
  ZapIcon,
  LockIcon,
  SettingsIcon,
  ArrowRightIcon,
  FilterIcon,
} from "lucide-react"
import { cn } from "cn"

interface ScanZohoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function FeatureHighlight({ icon: Icon, label, caption }: { icon: React.ElementType; label: string; caption: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-role-recruitment/10 text-role-recruitment">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-foreground">{label}</p>
        <p className="truncate text-[11px] text-muted-foreground">{caption}</p>
      </div>
    </div>
  )
}

function SectionNumber({ n }: { n: number }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-role-recruitment text-xs font-bold text-role-recruitment-foreground">
      {n}
    </span>
  )
}

export function ScanZohoModal({ open, onOpenChange }: ScanZohoModalProps) {
  const { data: connections, isLoading: connectionsLoading } = useQuery({
    queryKey: ["mail", "connections"],
    queryFn: mailApi.connections.list,
    enabled: open,
  })

  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("")
  const [scanResult, setScanResult] = useState<{
    scannedMessages: number
    detectedResumes: number
    skippedDuplicateAttachments: number
    skippedNonResumeAttachments: number
  } | null>(null)
  const [datePreset, setDatePreset] = useState<DateRangePreset | "">("")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [resolvedRange, setResolvedRange] = useState<{ from: string; to: string } | null>(null)
  const [showDateFilter, setShowDateFilter] = useState(false)
  const { scanZohoMail } = useResumeMutations()

  const activeConnections = (connections ?? []).filter((c) => c.status === "active")

  // Auto-select first active connection
  if (open && !selectedConnectionId && activeConnections.length > 0) {
    setSelectedConnectionId(activeConnections[0].id)
  }

  const handleScan = async () => {
    if (!selectedConnectionId) {
      toast.error("Please select a mailbox connection to scan")
      return
    }
    if (!resolvedRange) {
      toast.error("Please select a date range to scan")
      return
    }

    setScanResult(null)
    try {
      const res = await scanZohoMail.mutateAsync({ connectionId: selectedConnectionId, ...resolvedRange })
      setScanResult(res)

      const skippedParts: string[] = []
      if (res.skippedDuplicateAttachments > 0) {
        skippedParts.push(`${res.skippedDuplicateAttachments} already-imported`)
      }
      if (res.skippedNonResumeAttachments > 0) {
        skippedParts.push(`${res.skippedNonResumeAttachments} non-resume`)
      }
      const skippedSuffix = skippedParts.length > 0 ? ` Skipped ${skippedParts.join(" and ")} attachment(s).` : ""

      toast.success(`Scan complete! Found ${res.detectedResumes} new resume(s).${skippedSuffix}`)
    } catch (err: any) {
      toast.error(err?.message || "Failed to scan mailbox")
    }
  }

  const handleClose = () => {
    setScanResult(null)
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
        {/* Hero header — gradient icon chip + decorative blurred accent
            blobs, using Recruitment's own role-recruitment token. */}
        <SheetHeader className="relative overflow-hidden border-b bg-gradient-to-br from-role-recruitment/8 to-transparent pr-14">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full bg-role-recruitment/15 blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute right-16 top-4 size-16 rounded-full bg-role-recruitment/20 blur-xl"
          />
          <div className="relative flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-role-recruitment to-fuchsia-700 text-role-recruitment-foreground shadow-sm">
              <MailSearchIcon className="size-6" />
            </span>
            <div>
              <SheetTitle className="text-xl font-bold">Scan Mail</SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Detect and import resumes from recent inbox attachments.
              </SheetDescription>
            </div>
          </div>

          <div className="relative mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <FeatureHighlight icon={MailSearchIcon} label="Find Resumes" caption="Scan email attachments" />
            <FeatureHighlight icon={ShieldCheckIcon} label="Secure & Private" caption="Only authorized mailboxes" />
            <FeatureHighlight icon={ZapIcon} label="Save Time" caption="Import directly to pipeline" />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Section 1 — Mailbox connection */}
          <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <SectionNumber n={1} />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Select Mailbox Connection</h3>
                  <p className="text-xs text-muted-foreground">Choose the mailbox you want to scan for resumes.</p>
                </div>
              </div>
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
            ) : activeConnections.length === 0 ? (
              <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                No active Zoho Mail connections found. Connect a company or personal mailbox under Settings or Mail.
              </div>
            ) : (
              <div className="space-y-1.5">
                {activeConnections.map((conn) => (
                  <label
                    key={conn.id}
                    className={`flex items-center justify-between rounded-lg border p-2.5 text-xs cursor-pointer transition-colors bg-background ${
                      selectedConnectionId === conn.id
                        ? "border-role-recruitment ring-1 ring-role-recruitment/30"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="zoho-conn"
                        value={conn.id}
                        checked={selectedConnectionId === conn.id}
                        onChange={() => setSelectedConnectionId(conn.id)}
                        className="text-role-recruitment focus:ring-role-recruitment"
                      />
                      <div>
                        <p className="font-medium text-foreground">{conn.emailAddress}</p>
                        <p className="text-[11px] text-muted-foreground capitalize">
                          {conn.connectionType.replace("_", " ")} mailbox
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Section 2 — Date range, tucked behind a Filters toggle (same
              pattern as the Resumes list) instead of always taking up space. */}
          <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <SectionNumber n={2} />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Date Range to Scan</h3>
                  <p className="text-xs text-muted-foreground">Select the time period to look for resumes.</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDateFilter(!showDateFilter)}
                  className={cn(
                    "relative h-8 gap-1.5 rounded-full text-xs",
                    (showDateFilter || resolvedRange) && "border-role-recruitment text-role-recruitment bg-role-recruitment/5"
                  )}
                >
                  <FilterIcon className="size-3.5" />
                  Filters
                  {resolvedRange && (
                    <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-role-recruitment text-[10px] font-bold text-role-recruitment-foreground">
                      1
                    </span>
                  )}
                </Button>
                {resolvedRange && (
                  <Button type="button" variant="outline" size="sm" onClick={resetDateRange} className="h-8 rounded-full text-xs">
                    Reset
                  </Button>
                )}
              </div>
            </div>

            <div hidden={!showDateFilter} className="space-y-3">
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

            {!showDateFilter && resolvedRange && (
              <p className="text-xs text-foreground">
                {resolvedRange.from} → {resolvedRange.to}
              </p>
            )}
            {!showDateFilter && !resolvedRange && (
              <p className="text-xs text-muted-foreground">No date range selected yet — click Filters to choose one.</p>
            )}
          </div>

          {scanResult && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-50/40 p-3 text-xs dark:bg-emerald-950/20 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2Icon className="size-4" />
                <span>Scan Completed</span>
              </div>
              <p className="text-muted-foreground pl-5.5">
                Analyzed <strong>{scanResult.scannedMessages}</strong> messages. Identified and queued{" "}
                <strong className="text-emerald-600 dark:text-emerald-400">
                  {scanResult.detectedResumes}
                </strong>{" "}
                resumes for AI processing.
              </p>
              {(scanResult.skippedDuplicateAttachments > 0 || scanResult.skippedNonResumeAttachments > 0) && (
                <p className="text-muted-foreground pl-5.5">
                  Skipped {scanResult.skippedDuplicateAttachments} already-imported and{" "}
                  {scanResult.skippedNonResumeAttachments} non-resume attachment(s).
                </p>
              )}
              <p className="text-[11px] text-muted-foreground/80 pl-5.5">
                Duplicate candidates and unreadable resumes are flagged after AI processing completes — check the
                Duplicate / Not a Resume filters in the Resumes list shortly.
              </p>
            </div>
          )}

          <div className="flex items-start gap-3 rounded-xl border bg-muted/20 p-4">
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
        </div>

        <SheetFooter className="m-0 border-t bg-background p-3 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <LockIcon className="size-3" />
            We don&apos;t read or store your emails. We only process attachments to extract resumes.
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={scanZohoMail.isPending}>
              Close
            </Button>
            <Button
              size="sm"
              onClick={handleScan}
              disabled={!selectedConnectionId || !resolvedRange || scanZohoMail.isPending || activeConnections.length === 0}
              className="gap-1.5 bg-gradient-to-r from-role-recruitment to-fuchsia-700 text-role-recruitment-foreground hover:opacity-90"
            >
              {scanZohoMail.isPending ? (
                <>
                  <Loader2Icon className="size-3.5 animate-spin" />
                  Scanning Mailbox...
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
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

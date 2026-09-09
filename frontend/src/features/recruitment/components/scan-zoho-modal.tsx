"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { mailApi } from "@/features/mail/api"
import { useResumeMutations } from "../hooks"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { MailSearchIcon, Loader2Icon, CheckCircle2Icon, AlertCircleIcon } from "lucide-react"

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

  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("")
  const [scanResult, setScanResult] = useState<{ scannedMessages: number; detectedResumes: number } | null>(null)
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

    setScanResult(null)
    try {
      const res = await scanZohoMail.mutateAsync(selectedConnectionId)
      setScanResult(res)
      toast.success(`Mailbox scan complete! Found ${res.detectedResumes} new resume(s).`)
    } catch (err: any) {
      toast.error(err?.message || "Failed to scan mailbox")
    }
  }

  const handleClose = () => {
    setScanResult(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-role-recruitment/10 text-role-recruitment">
              <MailSearchIcon className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Scan Zoho Mailbox</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Detect and import resumes from recent inbox attachments.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-3 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Select Mailbox Connection</label>
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
                    className={`flex items-center justify-between rounded-lg border p-2.5 text-xs cursor-pointer transition-colors ${
                      selectedConnectionId === conn.id
                        ? "border-primary bg-primary/10"
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
                        className="text-primary focus:ring-primary"
                      />
                      <div>
                        <p className="font-medium text-foreground">{conn.emailAddress}</p>
                        <p className="text-[11px] text-muted-foreground capitalize">
                          {conn.connectionType.replace("_", " ")} mailbox
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      Active
                    </span>
                  </label>
                ))}
              </div>
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
            </div>
          )}

          <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground space-y-1">
            <p className="font-medium text-foreground flex items-center gap-1">
              <AlertCircleIcon className="size-3 text-role-recruitment" /> Safe & Gated Scanning
            </p>
            <p>
              Only authorized mailboxes you have permission to access are scanned. Extracted resumes are routed directly into your company&apos;s isolated recruitment pipeline.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={scanZohoMail.isPending}>
            Close
          </Button>
          <Button
            size="sm"
            onClick={handleScan}
            disabled={!selectedConnectionId || scanZohoMail.isPending || activeConnections.length === 0}
            className="gap-1.5"
          >
            {scanZohoMail.isPending ? (
              <>
                <Loader2Icon className="size-3.5 animate-spin" />
                Scanning Mailbox...
              </>
            ) : (
              <>
                <MailSearchIcon className="size-3.5" />
                Scan Mailbox
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

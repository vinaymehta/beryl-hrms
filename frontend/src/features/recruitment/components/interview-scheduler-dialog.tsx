"use client"

import { useMemo, useState } from "react"
import { useCandidateMutations } from "../hooks"
import { useEmployees } from "@/features/employees/hooks/use-employees"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { CalendarClockIcon, Loader2Icon, MailIcon, SearchIcon, EyeOffIcon, SendIcon } from "lucide-react"

interface InterviewSchedulerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidateId: string
  candidateName: string
  candidateEmail: string | null
  /** Set once a booking link has already gone out — makes this a resend. */
  interviewLinkSentAt: string | null
  interviewerId: string | null
  /** Shown if a search filters the current interviewer out of the loaded page. */
  interviewerName?: string | null
}

/**
 * Assigns the interviewer and sends the candidate a Calendly booking link.
 *
 * There is no date or time field on purpose: the candidate picks their own slot
 * from the availability configured on the Calendly event type, and the
 * interview only becomes "Interview Scheduled" when Calendly confirms the
 * booking. Until then the candidate stays Shortlisted, marked "Booking link
 * sent".
 */
export function InterviewSchedulerDialog({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  candidateEmail,
  interviewLinkSentAt,
  interviewerId,
  interviewerName,
}: InterviewSchedulerDialogProps) {
  const isResend = Boolean(interviewLinkSentAt)
  const { scheduleInterview } = useCandidateMutations()

  // The caller mounts this only while open and keys it by candidate, so these
  // initializers run fresh each time — no reset effect needed.
  const [selectedInterviewer, setSelectedInterviewer] = useState(interviewerId != null ? String(interviewerId) : "")
  const [employeeSearch, setEmployeeSearch] = useState("")

  // Interviewers are real Employee records, never free text. Active only —
  // someone who has left shouldn't be bookable.
  const { data: employeesPage, isLoading: employeesLoading } = useEmployees({
    status: "active",
    perPage: 100,
    q: employeeSearch.trim() || undefined,
  })

  // The employees endpoint serializes `id` as a number while the candidate's
  // interviewerId arrives as a string; coerce both so the "already listed?"
  // check below doesn't compare 2 === "2" and duplicate the entry.
  const interviewerItems = useMemo(
    () =>
      (employeesPage?.data ?? []).map((e) => ({
        value: String(e.id),
        label: [`${e.firstName} ${e.lastName}`.trim(), e.designation?.title].filter(Boolean).join(" — "),
      })),
    [employeesPage]
  )

  const totalEmployees = employeesPage?.meta?.totalCount ?? 0
  const hasMoreEmployees = totalEmployees > interviewerItems.length

  const items = useMemo(() => {
    if (!selectedInterviewer || interviewerItems.some((i) => i.value === selectedInterviewer)) return interviewerItems
    return [{ value: selectedInterviewer, label: interviewerName || "Currently selected" }, ...interviewerItems]
  }, [interviewerItems, selectedInterviewer, interviewerName])

  const canSubmit = Boolean(selectedInterviewer) && Boolean(candidateEmail) && !scheduleInterview.isPending

  const handleSubmit = async () => {
    if (!canSubmit) return
    try {
      await scheduleInterview.mutateAsync({ id: candidateId, interviewerId: selectedInterviewer })
      toast.success(isResend ? `New booking link sent to ${candidateName}` : `Booking link sent to ${candidateName}`, {
        description: `${candidateEmail} can now pick a slot. They'll show as Interview Scheduled once they book.`,
      })
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send the booking link")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-role-recruitment/10 text-role-recruitment">
              <CalendarClockIcon className="size-4" />
            </span>
            {isResend ? "Resend booking link" : "Schedule Interview"}
          </DialogTitle>
          <DialogDescription>
            Assign an interviewer and email {candidateName} a link to book their own slot.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="interviewer">Interviewer</Label>
            {hasMoreEmployees || employeeSearch ? (
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  placeholder={`Search ${totalEmployees} employees…`}
                  className="pl-8"
                />
              </div>
            ) : null}
            <Select
              items={items}
              value={selectedInterviewer}
              onValueChange={(v) => setSelectedInterviewer(v == null ? "" : String(v))}
            >
              <SelectTrigger id="interviewer" aria-label="Select interviewer" className="w-full">
                <SelectValue placeholder={employeesLoading ? "Loading employees…" : "Select an employee"} />
              </SelectTrigger>
              <SelectContent>
                {items.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!employeesLoading && items.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {employeeSearch ? "No employees match that search." : "No active employees to assign."}
              </p>
            )}
          </div>

          {/* Explains where the date actually comes from, so nobody goes
              looking for a date field that deliberately isn't here. */}
          <div className="flex items-start gap-2 rounded-lg border bg-muted/20 p-2.5 text-xs text-muted-foreground">
            <CalendarClockIcon className="size-3.5 shrink-0 mt-0.5" />
            <p>
              {candidateName} picks the slot themselves, from the availability set on your Calendly event type. Times are
              shown in <strong className="font-medium text-foreground">Asia/Kolkata</strong>. They move to{" "}
              <strong className="font-medium text-foreground">Interview Scheduled</strong> only once Calendly confirms
              the booking — and if they cancel, they move to Rejected automatically.
            </p>
          </div>

          {/* The interviewer is internal — stated plainly so nobody later
              "fixes" the candidate email by adding their name to it. */}
          <div className="flex items-start gap-2 rounded-lg border bg-muted/20 p-2.5 text-xs text-muted-foreground">
            <EyeOffIcon className="size-3.5 shrink-0 mt-0.5" />
            <p>
              The interviewer&apos;s name stays internal and is never included in the candidate&apos;s email. They are
              emailed separately once the slot is booked, with the resume attached.
            </p>
          </div>

          {!candidateEmail && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
              <MailIcon className="size-3.5 shrink-0 mt-0.5" />
              <p>
                No email address on file for {candidateName}, so the booking link can&apos;t be sent. Add one in the
                Personal Info tab first.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={scheduleInterview.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="gap-1.5 bg-role-recruitment text-role-recruitment-foreground hover:bg-role-recruitment/90"
          >
            {scheduleInterview.isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : <SendIcon className="size-3.5" />}
            {isResend ? "Resend link" : "Send booking link"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

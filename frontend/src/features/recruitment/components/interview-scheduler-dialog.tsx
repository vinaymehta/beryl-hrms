"use client"

import { useMemo, useState } from "react"
import { useCandidateMutations } from "../hooks"
import { useEmployees } from "@/features/employees/hooks/use-employees"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { CalendarClockIcon, Loader2Icon, MailIcon, SearchIcon, EyeOffIcon } from "lucide-react"

interface InterviewSchedulerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidateId: string
  candidateName: string
  candidateEmail: string | null
  /** Current interview instant (ISO), if already scheduled — makes this a reschedule. */
  interviewAt: string | null
  interviewerId: string | null
  /** Shown if a search filters the current interviewer out of the loaded page. */
  interviewerName?: string | null
}

// The API takes date and time as separate fields, so an existing interview has
// to be split back apart to prefill the form. Uses local-time getters, not
// toISOString(), which would shift the displayed time by the UTC offset.
function splitInstant(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: "", time: "" }
  const pad = (n: number) => String(n).padStart(2, "0")
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

/**
 * Books or re-books the single interview a candidate carries. Rescheduling is
 * the same form and the same request — the backend updates in place and
 * re-sends the candidate's invitation with the new details.
 */
export function InterviewSchedulerDialog({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  candidateEmail,
  interviewAt,
  interviewerId,
  interviewerName,
}: InterviewSchedulerDialogProps) {
  const isReschedule = Boolean(interviewAt)
  const { scheduleInterview } = useCandidateMutations()

  // Prefilled from the candidate's current interview, if any. The caller mounts
  // this component only while it's open and keys it by candidate + interview,
  // so these initializers run fresh for every open — no reset effect needed,
  // and a reschedule never starts from what was typed for a different candidate.
  const [date, setDate] = useState(() => splitInstant(interviewAt).date)
  const [time, setTime] = useState(() => splitInstant(interviewAt).time)
  const [selectedInterviewer, setSelectedInterviewer] = useState(interviewerId != null ? String(interviewerId) : "")
  const [employeeSearch, setEmployeeSearch] = useState("")

  // Interviewers are real Employee records, never free text. Only active
  // employees — someone who has left shouldn't be bookable.
  const { data: employeesPage, isLoading: employeesLoading } = useEmployees({
    status: "active",
    perPage: 100,
    q: employeeSearch.trim() || undefined,
  })

  // The employees endpoint serializes `id` as a number even though the type
  // says string, while the candidate's interviewerId arrives as a string.
  // Coerce both sides to strings here or the "is it already listed?" check
  // below compares 2 === "2", never matches, and duplicates the entry.
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

  // The selected interviewer can fall outside the currently-loaded page once a
  // search narrows the list. Keep them listed so the Select still shows a name
  // rather than a bare id, and so submitting doesn't silently drop them.
  const items = useMemo(() => {
    if (!selectedInterviewer || interviewerItems.some((i) => i.value === selectedInterviewer)) return interviewerItems
    return [{ value: selectedInterviewer, label: interviewerName || "Currently selected" }, ...interviewerItems]
  }, [interviewerItems, selectedInterviewer, interviewerName])

  const canSubmit = Boolean(date && time && selectedInterviewer) && !scheduleInterview.isPending

  const handleSubmit = async () => {
    if (!canSubmit) return
    try {
      await scheduleInterview.mutateAsync({
        id: candidateId,
        interviewDate: date,
        interviewTime: time,
        interviewerId: selectedInterviewer,
      })
      toast.success(
        isReschedule ? `Interview rescheduled for ${candidateName}` : `Interview scheduled for ${candidateName}`,
        { description: candidateEmail ? `Updated details emailed to ${candidateEmail}` : "No email on file — nothing was sent." }
      )
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to schedule the interview")
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
            {isReschedule ? "Reschedule Interview" : "Schedule Interview"}
          </DialogTitle>
          <DialogDescription>
            {isReschedule
              ? `Update the interview for ${candidateName}. The candidate is emailed the new date and time.`
              : `Book the interview for ${candidateName} and email them the details.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="interview-date">Date</Label>
              <Input id="interview-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interview-time">Time</Label>
              <Input id="interview-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

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
            <Select items={items} value={selectedInterviewer} onValueChange={(v) => setSelectedInterviewer(v == null ? "" : String(v))}>
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

          {/* The interviewer is internal information — say so plainly here, so
              nobody later "fixes" the email by adding the name to it. */}
          <div className="flex items-start gap-2 rounded-lg border bg-muted/20 p-2.5 text-xs text-muted-foreground">
            <EyeOffIcon className="size-3.5 shrink-0 mt-0.5" />
            <p>
              The candidate is told the <strong className="font-medium text-foreground">date and time only</strong>. The
              interviewer&apos;s name stays internal and is never included in the email.
            </p>
          </div>

          {!candidateEmail && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
              <MailIcon className="size-3.5 shrink-0 mt-0.5" />
              <p>This candidate has no email address on file — the interview is booked, but nothing is sent to them.</p>
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
            {scheduleInterview.isPending ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <CalendarClockIcon className="size-3.5" />
            )}
            {isReschedule ? "Reschedule & Notify" : "Schedule & Notify"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

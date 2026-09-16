"use client"

import { useState } from "react"
import { useCandidateMutations } from "../hooks"
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog"
import { InterviewCandidateHeader, InterviewFeedbackSummary } from "./interview-feedback"
import { toast } from "sonner"
import { CheckCircle2Icon, Loader2Icon } from "lucide-react"
import type { CandidateStatus, CandidateSummary } from "@/types/recruitment"
import { cn } from "cn"

interface InterviewActionsPanelProps {
  candidate: CandidateSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Only the two stages a HUMAN actually decides. The feedback stages are not
// here on purpose: they are driven by real events, not by an admin's opinion —
// sending the form sets "Link Sent", and the interviewer submitting it
// sets "Feedback Received". Letting an admin set those by hand would let the
// status claim feedback arrived when nothing was ever submitted.
const STATUS_OPTIONS: { value: CandidateStatus; label: string; caption: string; className: string }[] = [
  {
    value: "interview_scheduled",
    label: "Interview Scheduled",
    caption: "Booked, not yet held",
    className: "border-cyan-500/40 bg-cyan-500/10 text-cyan-600",
  },
  {
    value: "interview_completed",
    label: "Interview Completed",
    caption: "Held — ready to ask for feedback",
    className: "border-teal-500/40 bg-teal-500/10 text-teal-600",
  },
]

// Reached automatically, shown read-only so the current stage is still legible
// when the candidate is past the interview itself.
const AUTOMATIC_STAGES: Record<string, { label: string; caption: string; className: string }> = {
  feedback_not_received: {
    label: "Link Sent",
    caption: "Set automatically when the form was sent to the interviewer",
    className: "border-orange-500/40 bg-orange-500/10 text-orange-600",
  },
  feedback_received: {
    label: "Feedback Received",
    caption: "Set automatically when the interviewer submitted the form",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
  },
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>
}

/**
 * Everything an admin can DO to a candidate's interview, in one panel: change
 * the stage, send/resend the feedback form, and read the feedback they sent
 * back. Opened from the list's Actions column — the Status and Feedback
 * columns there are plain, non-interactive badges that only report state.
 */
export function InterviewActionsPanel({ candidate, open, onOpenChange }: InterviewActionsPanelProps) {
  const { setStatus } = useCandidateMutations()
  const [pendingValue, setPendingValue] = useState<CandidateStatus | null>(null)

  if (!candidate) return null

  const autoStage = AUTOMATIC_STAGES[candidate.status]

  const handlePick = async (value: CandidateStatus) => {
    if (value === candidate.status) return
    setPendingValue(value)
    try {
      await setStatus.mutateAsync({ id: candidate.id, status: value })
      toast.success(`${candidate.fullName} moved to ${STATUS_OPTIONS.find((o) => o.value === value)?.label}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change the status")
    } finally {
      setPendingValue(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-lg max-h-[88vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="border-b p-5 pr-12 bg-muted/20 space-y-3 shrink-0">
          <InterviewCandidateHeader candidate={candidate} />
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-6">
          {/* 1 — Stage. Only the interview itself is an admin decision; the
              feedback stages below it are reached by real events. */}
          <div className="space-y-2">
            <SectionLabel>Interview status</SectionLabel>

            {autoStage && (
              <div className={cn("rounded-lg border p-3", autoStage.className)}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{autoStage.label}</p>
                    <p className="text-xs opacity-80">{autoStage.caption}</p>
                  </div>
                  <CheckCircle2Icon className="size-4 shrink-0" />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              {STATUS_OPTIONS.map((opt) => {
                const isCurrent = candidate.status === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handlePick(opt.value)}
                    disabled={setStatus.isPending}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors disabled:opacity-60",
                      isCurrent ? opt.className : "hover:bg-muted/50"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.caption}</p>
                    </div>
                    {pendingValue === opt.value ? (
                      <Loader2Icon className="size-4 shrink-0 animate-spin" />
                    ) : isCurrent ? (
                      <CheckCircle2Icon className="size-4 shrink-0" />
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Set</span>
                    )}
                  </button>
                )
              })}
            </div>

            {autoStage && (
              <p className="text-[11px] text-muted-foreground">
                Picking a stage above rewinds this candidate to it — use it only to correct a mistake.
              </p>
            )}
          </div>

          {/* 2 — What came back. Read-only, and there is deliberately no
              "send form" action: the interviewer already received the form
              link with their booking email and fills it in after the
              interview. The admin's role here is to READ the result, not to
              chase it. */}
          <div className="space-y-2">
            <SectionLabel>Interviewer&apos;s feedback</SectionLabel>
            <InterviewFeedbackSummary candidate={candidate} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

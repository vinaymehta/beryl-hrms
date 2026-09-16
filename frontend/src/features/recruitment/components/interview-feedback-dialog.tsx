"use client"

import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog"
import { InterviewCandidateHeader, InterviewFeedbackSummary } from "./interview-feedback"
import type { CandidateSummary } from "@/types/recruitment"

interface InterviewFeedbackDialogProps {
  candidate: CandidateSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * What the interviewer submitted, and nothing else — opened by clicking a row
 * in the Feedback Received list.
 *
 * Those rows used to open the general candidate profile, which answered a
 * question nobody asked there: the reason to click a candidate under
 * "Feedback Received" is to read the feedback, not to re-read their resume.
 * Every answer shown here comes from the candidate summary the list already
 * loaded, so opening it costs no extra request.
 */
export function InterviewFeedbackDialog({ candidate, open, onOpenChange }: InterviewFeedbackDialogProps) {
  if (!candidate) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-lg max-h-[88vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="border-b p-5 pr-12 bg-muted/20 space-y-3 shrink-0">
          <InterviewCandidateHeader candidate={candidate} />
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Interviewer&apos;s feedback
          </p>
          <InterviewFeedbackSummary candidate={candidate} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

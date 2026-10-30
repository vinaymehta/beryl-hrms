"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowRightIcon, BadgeCheckIcon, CalendarClockIcon, Loader2Icon, MessageSquareIcon, UserCheckIcon } from "lucide-react"
import { useCandidateMutations } from "../hooks"
import { InterviewFeedbackDetails } from "./interview-feedback"
import { DECISION_META, formatIst } from "../lib/interview-feedback"
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
import type { CandidateStatus, InterviewFeedback } from "@/types/recruitment"
import { errorMessage } from "@/lib/errors"
import { cn } from "cn"

/** Offered is the step after the interviewer's write-up, and only once. */
export function canMarkOffered(status: CandidateStatus | null | undefined, feedbackSubmittedAt: string | null | undefined) {
  return Boolean(feedbackSubmittedAt) && status !== "offered" && status !== "rejected"
}

/** Moves the candidate to Offered, behind a confirm. Status only — nothing is emailed. */
export function MarkOfferedButton({ candidateId, candidateName }: { candidateId: string; candidateName: string }) {
  const [open, setOpen] = useState(false)
  const { offer } = useCandidateMutations()

  const handleConfirm = async () => {
    try {
      await offer.mutateAsync(candidateId)
      toast.success(`${candidateName} marked as offered`)
      setOpen(false)
    } catch (err) {
      toast.error(errorMessage(err, "Failed to mark as offered"))
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5 bg-success text-success-foreground hover:bg-success/90">
        <BadgeCheckIcon className="size-3.5" />
        Mark as offered
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark {candidateName} as offered?</DialogTitle>
            <DialogDescription>
              Moves them to Offered. No email is sent — share the offer with them yourself.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" size="sm" />}>Cancel</DialogClose>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              disabled={offer.isPending}
              className="gap-1.5 bg-success text-success-foreground hover:bg-success/90"
            >
              {offer.isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : <BadgeCheckIcon className="size-3.5" />}
              Mark as offered
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface InterviewSummaryProps {
  candidateId: string
  interviewAt: string | null
  interviewerName: string | null
  feedbackRequestedAt: string | null
  feedback: InterviewFeedback
}

/**
 * One line on where a candidate's interview stands — when, with whom, and the
 * feedback — with the way into the Interviews page, where everything about it
 * is actioned. Read-only: the interview's own buttons live there, not here.
 */
export function InterviewSummary({ candidateId, interviewAt, interviewerName, feedbackRequestedAt, feedback }: InterviewSummaryProps) {
  const decision = feedback.decision ? DECISION_META[feedback.decision] : null

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
      <span className="inline-flex items-center gap-1.5 text-foreground">
        <CalendarClockIcon className="size-3.5 text-muted-foreground" />
        {interviewAt ? `${formatIst(interviewAt)} IST` : "Not booked yet"}
      </span>
      <span className="inline-flex items-center gap-1.5 text-foreground">
        <UserCheckIcon className="size-3.5 text-muted-foreground" />
        {interviewerName || "No interviewer assigned"}
      </span>
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <MessageSquareIcon className="size-3.5" />
        {feedback.submittedAt ? (
          <>
            <span className="text-success">Feedback received {formatIst(feedback.submittedAt, "date")}</span>
            {feedback.overallRating != null && <span className="text-foreground">· {feedback.overallRating}/5</span>}
            {decision && (
              <span className={cn("inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-medium", decision.className)}>
                {decision.label}
              </span>
            )}
          </>
        ) : feedbackRequestedAt ? (
          `Feedback requested ${formatIst(feedbackRequestedAt, "date")}`
        ) : (
          "Feedback not requested"
        )}
      </span>
      <Link
        href={`/recruitment/interviews?candidate=${candidateId}`}
        className="inline-flex items-center gap-1 font-medium text-role-recruitment hover:underline"
      >
        Open in Interviews
        <ArrowRightIcon className="size-3" />
      </Link>
    </div>
  )
}

/** The interviewer's full write-up, or what it's waiting on. */
export function InterviewFeedbackSection({ feedback, feedbackRequestedAt }: { feedback: InterviewFeedback; feedbackRequestedAt: string | null }) {
  if (feedback.submittedAt) return <InterviewFeedbackDetails feedback={feedback} />

  return (
    <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
      {feedbackRequestedAt
        ? `Feedback was requested ${formatIst(feedbackRequestedAt)} IST — nothing back from the interviewer yet.`
        : "No feedback yet. It is requested from the interviewer once the interview is over."}
    </p>
  )
}

"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DialogDescription, DialogTitle } from "@/components/ui/dialog"
import {
  CalendarClockIcon,
  ClockIcon,
  MinusCircleIcon,
  StarIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  UserCheckIcon,
} from "lucide-react"
import type { CandidateSummary, InterviewFeedback } from "@/types/recruitment"
import { DECISION_META, FEEDBACK_AREAS, RATING_LABELS, formatIst } from "../lib/interview-feedback"
import { cn } from "cn"

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (`${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase()) || "?"
}

/**
 * Who this is and when their interview is/was — shared by every dialog the
 * interview list opens, so a candidate looks the same whichever of them the
 * row routes to.
 */
export function InterviewCandidateHeader({ candidate }: { candidate: CandidateSummary }) {
  return (
    <>
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="size-11 shrink-0">
          <AvatarFallback className="bg-role-recruitment/12 text-sm font-semibold text-role-recruitment">
            {initials(candidate.fullName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <DialogTitle className="truncate text-base font-bold text-foreground">{candidate.fullName}</DialogTitle>
          <DialogDescription className="truncate text-xs">
            {candidate.email || candidate.currentRole || "No contact on file"}
          </DialogDescription>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClockIcon className="size-3.5" />
          {candidate.interviewAt
            ? new Date(candidate.interviewAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : "Not scheduled"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <UserCheckIcon className="size-3.5" />
          {candidate.interviewerName || "No interviewer"}
        </span>
      </div>
    </>
  )
}

/**
 * What the interviewer actually submitted through the feedback form, exactly
 * as they left it. Read-only on purpose: nobody but the interviewer writes
 * this.
 *
 * Shared by the interview actions panel (where it sits under the stage
 * controls) and by the feedback dialog the Feedback Received list opens, so
 * the submitted answers render identically in both.
 */
export function InterviewFeedbackSummary({ candidate }: { candidate: CandidateSummary }) {
  const submitted = Boolean(candidate.feedbackSubmittedAt)
  const requested = Boolean(candidate.feedbackRequestedAt)

  if (!submitted) {
    // Asked-and-waiting and never-asked are genuinely different — collapsing
    // them would report feedback as outstanding when nobody has requested it.
    return (
      <div className="space-y-2 rounded-lg border border-dashed p-6 text-center">
        {requested ? (
          <>
            <ClockIcon className="mx-auto size-7 text-warning/50" />
            <p className="text-sm font-medium text-foreground">Waiting on the interviewer</p>
            <p className="text-xs text-muted-foreground">
              Sent{candidate.interviewerName ? ` to ${candidate.interviewerName}` : ""} on{" "}
              {new Date(candidate.feedbackRequestedAt!).toLocaleDateString()}.
            </p>
          </>
        ) : (
          <>
            <MinusCircleIcon className="mx-auto size-7 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No feedback form sent yet</p>
            <p className="text-xs text-muted-foreground">
              It goes to the interviewer automatically an hour after the interview, or send it now.
            </p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-3">
      <InterviewFeedbackDetails feedback={feedbackFromCandidate(candidate)} />
    </div>
  )
}

function feedbackFromCandidate(candidate: CandidateSummary): InterviewFeedback {
  return {
    submittedAt: candidate.feedbackSubmittedAt,
    technicalRating: candidate.feedbackTechnicalRating,
    communicationRating: candidate.feedbackCommunicationRating,
    problemSolvingRating: candidate.feedbackProblemSolvingRating,
    cultureFitRating: candidate.feedbackCultureFitRating,
    overallRating: candidate.feedbackRating,
    decision: candidate.feedbackDecision,
    wouldRecommend: candidate.feedbackWouldRecommend,
    strengths: candidate.feedbackStrengths,
    weaknesses: candidate.feedbackWeaknesses,
    comments: candidate.feedbackComments,
  }
}

function Stars({ value, size = "size-4" }: { value: number | null; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon
          key={n}
          className={cn(
            size,
            value != null && n <= value ? "fill-warning text-warning" : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  )
}

function TextBlock({ label, text, empty }: { label: string; text: string | null; empty: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      {text ? (
        <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm text-foreground">{text}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  )
}

/**
 * Everything the interviewer submitted, read-only. Rows from the old form
 * have only an overall rating, a yes/no recommendation and comments — the
 * structured sections simply don't render for them.
 */
export function InterviewFeedbackDetails({ feedback }: { feedback: InterviewFeedback }) {
  const hasAreas = FEEDBACK_AREAS.some((area) => feedback[area.key] != null)
  const decision = feedback.decision ? DECISION_META[feedback.decision] : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Overall rating</p>
          <div className="flex items-center gap-2">
            <Stars value={feedback.overallRating} />
            {feedback.overallRating != null && (
              <span className="text-sm text-foreground">
                {feedback.overallRating}/5
                {RATING_LABELS[feedback.overallRating - 1] ? ` — ${RATING_LABELS[feedback.overallRating - 1]}` : ""}
              </span>
            )}
          </div>
        </div>

        {decision && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Decision</p>
            <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", decision.className)}>
              {decision.label}
            </span>
          </div>
        )}
      </div>

      {hasAreas && (
        <div className="grid gap-2 rounded-lg bg-muted/30 p-3 sm:grid-cols-2">
          {FEEDBACK_AREAS.map((area) => (
            <div key={area.key} className="flex items-center justify-between gap-2">
              <span className="text-xs text-foreground/80">{area.label}</span>
              <span className="flex items-center gap-1.5">
                <Stars value={feedback[area.key]} size="size-3.5" />
                <span className="w-6 text-right text-xs text-muted-foreground">
                  {feedback[area.key] != null ? `${feedback[area.key]}/5` : "—"}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* The old form's yes/no — shown only for rows that have it. */}
      {feedback.wouldRecommend != null && !decision && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Recommend moving forward</p>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
              feedback.wouldRecommend
                ? "border-success/30 bg-success/10 text-success"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            )}
          >
            {feedback.wouldRecommend ? <ThumbsUpIcon className="size-3.5" /> : <ThumbsDownIcon className="size-3.5" />}
            {feedback.wouldRecommend ? "Yes" : "No"}
          </span>
        </div>
      )}

      {(hasAreas || feedback.strengths || feedback.weaknesses) && (
        <>
          <TextBlock label="Strengths" text={feedback.strengths} empty="None noted." />
          <TextBlock label="Weaknesses" text={feedback.weaknesses} empty="None noted." />
        </>
      )}
      <TextBlock label="Overall comments" text={feedback.comments} empty="No comments were left." />

      {feedback.submittedAt && (
        <p className="text-[11px] text-muted-foreground">Submitted {formatIst(feedback.submittedAt)} IST</p>
      )}
    </div>
  )
}

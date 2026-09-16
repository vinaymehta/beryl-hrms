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
import type { CandidateSummary } from "@/types/recruitment"
import { cn } from "cn"

const RATING_LABELS = ["Poor", "Fair", "Good", "Great", "Excellent"]

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
 * What the interviewer actually submitted through the feedback form — rating,
 * recommendation and comments, exactly as they left them. Read-only on
 * purpose: nobody but the interviewer writes this.
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
            <ClockIcon className="mx-auto size-7 text-orange-500/50" />
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
              Send one to the interviewer once the interview has been held.
            </p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-lg border p-3">
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Overall rating</p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <StarIcon
                key={n}
                className={cn(
                  "size-4",
                  candidate.feedbackRating != null && n <= candidate.feedbackRating
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/30"
                )}
              />
            ))}
          </div>
          {candidate.feedbackRating != null && (
            <span className="text-sm text-foreground">
              {candidate.feedbackRating}/5
              {RATING_LABELS[candidate.feedbackRating - 1] ? ` — ${RATING_LABELS[candidate.feedbackRating - 1]}` : ""}
            </span>
          )}
        </div>
      </div>

      {candidate.feedbackWouldRecommend != null && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Recommend moving forward</p>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
              candidate.feedbackWouldRecommend
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                : "border-red-500/30 bg-red-500/10 text-red-600"
            )}
          >
            {candidate.feedbackWouldRecommend ? (
              <ThumbsUpIcon className="size-3.5" />
            ) : (
              <ThumbsDownIcon className="size-3.5" />
            )}
            {candidate.feedbackWouldRecommend ? "Yes" : "No"}
          </span>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Comments</p>
        {candidate.feedbackComments ? (
          <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm text-foreground">
            {candidate.feedbackComments}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No comments were left.</p>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Submitted{" "}
        {new Date(candidate.feedbackSubmittedAt!).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </p>
    </div>
  )
}

"use client"

import { cn } from "cn"
import { InfoIcon, TriangleAlertIcon } from "lucide-react"

import { RATING_SCALE, RATINGS_REQUIRING_COMMENT, SIGNIFICANT_RATING_GAP } from "@/features/appraisals/constants"
import type { AppraisalTemplateQuestion } from "@/types/appraisals"

export interface AnswerValue {
  rating: number | null
  comment: string
}

export const EMPTY_ANSWER: AnswerValue = { rating: null, comment: "" }

/** The scope's 1–5 scale (§6), with each point's wording on the control itself. */
export function RatingScaleInput({
  value,
  onChange,
  disabled,
  labelledBy,
}: {
  value: number | null
  onChange: (next: number) => void
  disabled?: boolean
  labelledBy?: string
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" role="radiogroup" aria-labelledby={labelledBy}>
      {RATING_SCALE.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${option.value} — ${option.label}`}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            title={option.description}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center transition-colors",
              active
                ? "border-role-hr bg-role-hr/8 ring-1 ring-role-hr"
                : "border-input hover:border-role-hr/40 hover:bg-accent/60",
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            <span className="flex items-center gap-1.5">
              {/* A real radio dot rather than a filled block: five solid
                  buttons in a row read as five separate actions, where this
                  reads as one choice with five options. */}
              <span
                aria-hidden
                className={cn(
                  "flex size-3.5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  active ? "border-role-hr" : "border-muted-foreground/40"
                )}
              >
                {active && <span className="size-1.5 rounded-full bg-role-hr" />}
              </span>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  active ? "text-role-hr" : "text-foreground"
                )}
              >
                {option.value}
              </span>
            </span>
            <span className={cn("text-[11px] leading-tight", active ? "text-role-hr" : "text-muted-foreground")}>
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Mirrors the backend rule (AppraisalAnswer): 1, 2, 4 and 5 need justifying. */
export function needsEvidence(answer: AnswerValue) {
  return answer.rating != null && RATINGS_REQUIRING_COMMENT.includes(answer.rating) && !answer.comment.trim()
}

/**
 * One question: the prompt, the 1–5 rating, the evidence box, and — for a
 * reviewer — the employee's own answer sitting READ-ONLY beside it.
 *
 * Shared by the employee's step-by-step self-appraisal and by every reviewer's
 * form, so the scale, the evidence rule and the rating-gap flag can't come to
 * mean different things on the two screens.
 */
export function QuestionAnswer({
  question,
  value,
  onChange,
  reference,
  referenceLabel,
  hidePrompt,
  guideLength,
}: {
  question: AppraisalTemplateQuestion
  value: AnswerValue
  onChange: (patch: Partial<AnswerValue>) => void
  /** The employee's own answer, when this form belongs to a reviewer. */
  reference?: { rating: number | null; comment: string | null }
  referenceLabel?: string
  /** For a one-question area whose only question repeats the area's own name. */
  hidePrompt?: boolean
  /**
   * Shows a `n/guide` counter under the evidence box. A GUIDE, not a cap —
   * nothing is truncated and the backend stores `text` with no length limit,
   * so going over turns the counter amber rather than eating what was typed.
   */
  guideLength?: number
}) {
  const missing = needsEvidence(value)
  // Scope §12: a significant gap between the employee's own rating and the
  // reviewer's is flagged, so calibration has something to look at rather than
  // two numbers sitting silently side by side.
  const gap = reference?.rating != null && value.rating != null ? value.rating - reference.rating : null
  const significantGap = gap != null && Math.abs(gap) >= SIGNIFICANT_RATING_GAP

  return (
    <div className="grid gap-2 border-b pb-4 last:border-0 last:pb-0">
      <div className={cn(hidePrompt && "sr-only")}>
        <p id={`question-${question.id}`} className="text-sm font-medium text-foreground">
          {question.prompt}
        </p>
        {question.description && <p className="text-xs text-muted-foreground">{question.description}</p>}
      </div>

      {reference && (
        <div
          className={cn(
            "grid gap-1 rounded-lg border border-dashed bg-muted/40 p-2.5",
            significantGap && "border-warning bg-warning/5"
          )}
        >
          <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <InfoIcon className="size-3" />
            {referenceLabel} rated {reference.rating ?? "—"}
            {significantGap && (
              <span className="flex items-center gap-1 rounded-full bg-warning/15 px-1.5 py-0.5 text-warning">
                <TriangleAlertIcon className="size-3" />
                {gap > 0 ? `You rated ${gap} higher` : `You rated ${Math.abs(gap)} lower`}
              </span>
            )}
          </p>
          {reference.comment && <p className="text-xs text-muted-foreground">{reference.comment}</p>}
        </div>
      )}

      <RatingScaleInput
        value={value.rating}
        labelledBy={`question-${question.id}`}
        onChange={(rating) => onChange({ rating })}
      />

      <div className="relative">
        <textarea
          rows={3}
          aria-label={`Evidence for: ${question.prompt}`}
          value={value.comment}
          onChange={(event) => onChange({ comment: event.target.value })}
          placeholder={
            question.requiresComment
              ? "Evidence (required for this question)"
              : "Share specific examples, projects or evidence…"
          }
          className={cn(
            "w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
            guideLength && "pb-6",
            missing && "border-warning"
          )}
        />
        {guideLength && (
          <span
            className={cn(
              "pointer-events-none absolute right-2.5 bottom-2 text-[11px] tabular-nums",
              value.comment.length > guideLength ? "text-warning" : "text-muted-foreground"
            )}
          >
            {value.comment.length}/{guideLength}
          </span>
        )}
      </div>
      {missing && (
        <p className="flex items-center gap-1.5 text-xs text-warning">
          <TriangleAlertIcon className="size-3.5" />A rating of {value.rating} needs evidence.
        </p>
      )}
    </div>
  )
}

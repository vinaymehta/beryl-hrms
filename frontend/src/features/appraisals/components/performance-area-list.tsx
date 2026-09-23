"use client"

import { useState } from "react"
import { ChevronDownIcon, InfoIcon, TriangleAlertIcon } from "lucide-react"
import { cn } from "cn"

import { Badge } from "@/components/ui/badge"
import { RatingSelect } from "@/features/appraisals/components/rating-select"
import {
  EMPTY_ANSWER, needsEvidence, type AnswerValue,
} from "@/features/appraisals/components/question-answer"
import { SIGNIFICANT_RATING_GAP } from "@/features/appraisals/constants"
import type { AppraisalTemplateCategory } from "@/types/appraisals"

/** The length the evidence box is sized for. A guide, not a cap. */
const EVIDENCE_GUIDE_LENGTH = 1000

type ReferenceAnswer = { rating: number | null; comment: string | null }

/**
 * The performance areas, as an accordion.
 *
 * Seven areas each carrying a brief, a rating and an evidence box do not fit
 * on one screen expanded — so one opens at a time and the rest collapse to a
 * single line showing number, name and weight. That is what makes the whole
 * set reviewable at a glance before you start, and it is why the weights are
 * visible on the collapsed rows rather than only inside.
 *
 * Shared by the employee and every reviewer. A reviewer additionally gets the
 * employee's own answer shown read-only beside their own inputs, which is the
 * one thing that differs.
 */
export function PerformanceAreaList({
  categories,
  answers,
  onChange,
  readOnly,
  reference,
  referenceLabel,
  action,
}: {
  categories: AppraisalTemplateCategory[]
  answers: Record<string, AnswerValue>
  onChange: (questionId: string, patch: Partial<AnswerValue>) => void
  readOnly?: boolean
  reference?: Record<string, ReferenceAnswer>
  referenceLabel?: string
  /** The workbook download/upload controls, on the heading row. */
  action?: React.ReactNode
}) {
  const [open, setOpen] = useState<string | null>(categories[0]?.id ?? null)
  const totalWeight = categories.reduce((sum, category) => sum + Number(category.weight), 0)

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground">Performance areas</h2>
          <p className="text-sm text-muted-foreground">
            Rate each area and provide evidence or examples to support your ratings.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 tabular-nums",
              Math.abs(totalWeight - 100) < 0.01 ? "text-foreground" : "border-warning/50 text-warning"
            )}
          >
            Total weight {totalWeight}%
          </Badge>
        </div>
      </div>

      <ul className="grid gap-2">
        {categories.map((category, index) => {
          const isOpen = open === category.id
          // One question per area is the common shape; a multi-question area
          // still works because every question inside renders in turn.
          const rated = category.questions.filter(
            (question) => (answers[question.id]?.rating ?? null) != null
          ).length

          return (
            <li key={category.id} className="overflow-hidden rounded-xl border bg-card">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : category.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                    rated === category.questions.length && category.questions.length > 0
                      ? "bg-role-hr text-role-hr-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{category.name}</span>
                {/* How much of THIS area is done, on the collapsed row.
                    An area can hold more than one question, and only the open
                    one is in the DOM — so without this the second question of
                    a collapsed area is invisible, and the first hint that it
                    was missed comes at the very end. */}
                {category.questions.length > 0 && (
                  <span
                    className={cn(
                      "shrink-0 text-xs tabular-nums",
                      rated === category.questions.length ? "text-success" : "text-muted-foreground"
                    )}
                  >
                    {rated} of {category.questions.length} rated
                  </span>
                )}
                <Badge variant="outline" className="shrink-0 tabular-nums">
                  {Number(category.weight)}% weight
                </Badge>
                <ChevronDownIcon
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180"
                  )}
                />
              </button>

              {isOpen && (
                <div className="border-t p-4">
                  <div className="grid min-w-0 gap-4">
                    {category.description && (
                      <div>
                        <p className="text-xs font-semibold text-foreground">What is evaluated</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{category.description}</p>
                      </div>
                    )}

                    {category.questions.map((question) => (
                      <AreaQuestion
                        key={question.id}
                        prompt={question.prompt === category.name ? null : question.prompt}
                        description={question.description}
                        required={question.required}
                        requiresComment={question.requiresComment}
                        value={answers[question.id] ?? EMPTY_ANSWER}
                        onChange={(patch) => onChange(question.id, patch)}
                        readOnly={readOnly}
                        reference={reference?.[String(question.id)]}
                        referenceLabel={referenceLabel}
                      />
                    ))}
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function AreaQuestion({
  prompt,
  description,
  required,
  requiresComment,
  value,
  onChange,
  readOnly,
  reference,
  referenceLabel,
}: {
  prompt: string | null
  description: string | null
  required: boolean
  requiresComment: boolean
  value: AnswerValue
  onChange: (patch: Partial<AnswerValue>) => void
  readOnly?: boolean
  reference?: ReferenceAnswer
  referenceLabel?: string
}) {
  const missing = needsEvidence(value)
  // Scope §12: a significant gap between the employee's own rating and the
  // reviewer's is flagged, so calibration has something to look at rather than
  // two numbers sitting silently side by side.
  const gap = reference?.rating != null && value.rating != null ? value.rating - reference.rating : null
  const significantGap = gap != null && Math.abs(gap) >= SIGNIFICANT_RATING_GAP

  return (
    <div className="grid gap-3">
      {prompt && (
        <div>
          <p className="text-sm font-medium text-foreground">
            {prompt}
            {required && <span className="ml-1 text-destructive">*</span>}
          </p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      )}

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

      <div className="grid gap-4 sm:grid-cols-[13rem_minmax(0,1fr)]">
        <div className="grid gap-1">
          <p className="text-xs font-semibold text-foreground">
            Your rating
            {required && <span className="ml-1 text-destructive">*</span>}
          </p>
          <RatingSelect
            value={value.rating}
            disabled={readOnly}
            onChange={(rating) => onChange({ rating })}
          />
        </div>

        <div className="grid gap-1">
          <p className="text-xs font-semibold text-foreground">
            Your comments &amp; evidence
            {requiresComment && <span className="ml-1 text-destructive">*</span>}
          </p>
          <div className="relative">
            <textarea
              rows={3}
              readOnly={readOnly}
              aria-label="Comments and evidence"
              value={value.comment}
              onChange={(event) => onChange({ comment: event.target.value })}
              placeholder="Share examples, achievements or evidence…"
              className={cn(
                "w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 pb-6 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
                missing && "border-warning"
              )}
            />
            <span
              className={cn(
                "pointer-events-none absolute right-2.5 bottom-2 text-[11px] tabular-nums",
                value.comment.length > EVIDENCE_GUIDE_LENGTH ? "text-warning" : "text-muted-foreground"
              )}
            >
              {value.comment.length}/{EVIDENCE_GUIDE_LENGTH}
            </span>
          </div>
          {missing && (
            <p className="flex items-center gap-1.5 text-xs text-warning">
              <TriangleAlertIcon className="size-3.5" />A rating of {value.rating} needs evidence.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

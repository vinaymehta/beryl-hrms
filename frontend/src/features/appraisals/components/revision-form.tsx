"use client"

import { useMemo, useState } from "react"
import { cn } from "cn"
import { InfoIcon, TriangleAlertIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LensBadge } from "@/features/appraisals/components/appraisal-badges"
import {
  RATING_SCALE,
  RATINGS_REQUIRING_COMMENT,
  NARRATIVE_FIELDS,
  SIGNIFICANT_RATING_GAP,
  type NarrativeKey,
} from "@/features/appraisals/constants"
import { SelfAppraisalImport } from "@/features/appraisals/components/self-appraisal-import"
import type { AppraisalDetail, AppraisalRevision, ImportPreviewRow } from "@/types/appraisals"

type AnswerState = Record<string, { rating: number | null; comment: string }>
type NarrativeState = Record<NarrativeKey, string>

const EMPTY_NARRATIVE: NarrativeState = {
  summary: "", achievements: "", strengths: "", improvementAreas: "", trainingNeeds: "", nextPeriodGoals: "",
}

function narrativeFrom(revision: AppraisalRevision | undefined): NarrativeState {
  if (!revision) return { ...EMPTY_NARRATIVE }
  return {
    summary: revision.summary ?? "",
    achievements: revision.achievements ?? "",
    strengths: revision.strengths ?? "",
    improvementAreas: revision.improvementAreas ?? "",
    trainingNeeds: revision.trainingNeeds ?? "",
    nextPeriodGoals: revision.nextPeriodGoals ?? "",
  }
}

function Rating({
  value,
  onChange,
  disabled,
}: {
  value: number | null
  onChange: (next: number) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {RATING_SCALE.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            title={option.description}
            className={cn(
              "flex min-w-[5.5rem] flex-1 flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 text-center transition-colors",
              active
                ? "border-role-hr bg-role-hr text-role-hr-foreground"
                : "border-input hover:bg-accent hover:text-accent-foreground",
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            <span className="text-sm font-semibold tabular-nums">{option.value}</span>
            <span className={cn("text-[10px] leading-tight", active ? "opacity-90" : "text-muted-foreground")}>
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * The rating form, shared by the employee's self-appraisal and by every
 * reviewer — one component so the question set, the 1–5 scale and the
 * evidence rule can't drift between them.
 *
 * `reference` is the revision shown READ-ONLY alongside the inputs: for a
 * manager that is the employee's own self-appraisal, so the two sit
 * side by side and are never merged into a single value. The employee sees no
 * reference at all, because there is nothing they are permitted to compare
 * against yet.
 */
export function RevisionForm({
  appraisal,
  reference,
  submitLabel,
  isPending,
  onSubmit,
  onSaveDraft,
  allowImport = false,
}: {
  appraisal: AppraisalDetail
  reference?: AppraisalRevision
  submitLabel: string
  isPending: boolean
  /** The spreadsheet path is offered for the employee's own self-appraisal only. */
  allowImport?: boolean
  onSubmit: (payload: { answers: unknown[]; narrative: NarrativeState }) => void
  /** Only the employee gets a draft option; a reviewer's submission is final. */
  onSaveDraft?: (payload: { answers: unknown[]; narrative: NarrativeState }) => void
}) {
  const categories = appraisal.template.categories
  const [answers, setAnswers] = useState<AnswerState>({})
  // Always blank: every revision is its own author's words. A reviewer writing
  // V2 does not start from the employee's V1 text.
  const [narrative, setNarrative] = useState<NarrativeState>(() => narrativeFrom(undefined))

  const referenceAnswers = useMemo(() => {
    const map: Record<string, { rating: number | null; comment: string | null }> = {}
    reference?.answers.forEach((answer) => {
      map[String(answer.appraisalTemplateQuestionId)] = { rating: answer.rating, comment: answer.comment }
    })
    return map
  }, [reference])

  /** Confirmed spreadsheet rows land in the form as ordinary edits. */
  function applyImported(rows: ImportPreviewRow[]) {
    setAnswers((prev) => {
      const next = { ...prev }
      rows.forEach((row) => {
        next[String(row.questionId)] = { rating: row.rating, comment: row.comment ?? "" }
      })
      return next
    })
  }

  function setAnswer(questionId: string, patch: Partial<{ rating: number | null; comment: string }>) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...{ rating: null, comment: "" }, ...prev[questionId], ...patch },
    }))
  }

  // Mirrors the backend rule (AppraisalAnswer): a rating at or next to either
  // extreme has to be justified. Surfaced before submitting rather than after.
  const missingEvidence = useMemo(
    () =>
      Object.entries(answers).filter(
        ([, answer]) =>
          answer.rating != null &&
          RATINGS_REQUIRING_COMMENT.includes(answer.rating) &&
          !answer.comment.trim()
      ).length,
    [answers]
  )

  function buildPayload() {
    return {
      answers: Object.entries(answers)
        .filter(([, answer]) => answer.rating != null || answer.comment.trim())
        .map(([questionId, answer]) => ({
          questionId,
          rating: answer.rating,
          comment: answer.comment,
        })),
      narrative,
    }
  }

  return (
    <div className="grid gap-4">
      {allowImport && <SelfAppraisalImport appraisalId={appraisal.id} onConfirm={applyImported} />}

      {categories.map((category) => (
        <section key={category.id} className="overflow-hidden rounded-xl border bg-card shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">{category.name}</h3>
              {category.description && (
                <p className="truncate text-xs text-muted-foreground">{category.description}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <LensBadge lens={category.lens} />
              <Badge variant="outline" className="tabular-nums">
                {Number(category.weight)}%
              </Badge>
            </div>
          </div>

          <div className="grid gap-4 p-4">
            {category.questions.map((question) => {
              const current = answers[question.id] ?? { rating: null, comment: "" }
              const ref = referenceAnswers[String(question.id)]
              const needsEvidence =
                current.rating != null && RATINGS_REQUIRING_COMMENT.includes(current.rating) && !current.comment.trim()
              // Scope §12: a significant gap between the employee's own rating
              // and the reviewer's is flagged, so calibration has something to
              // look at rather than two numbers sitting silently side by side.
              const gap =
                ref?.rating != null && current.rating != null ? current.rating - ref.rating : null
              const significantGap = gap != null && Math.abs(gap) >= SIGNIFICANT_RATING_GAP

              return (
                <div key={question.id} className="grid gap-2 border-b pb-4 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{question.prompt}</p>
                    {question.description && (
                      <p className="text-xs text-muted-foreground">{question.description}</p>
                    )}
                  </div>

                  {/* The employee's own answer, read-only, next to the reviewer's
                      inputs — never merged into one field. */}
                  {ref && (
                    <div
                      className={cn(
                        "grid gap-1 rounded-lg border border-dashed bg-muted/40 p-2.5",
                        significantGap && "border-warning bg-warning/5"
                      )}
                    >
                      <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                        <InfoIcon className="size-3" />
                        {reference?.label} · {reference?.authorName} rated {ref.rating ?? "—"}
                        {significantGap && (
                          <span className="flex items-center gap-1 rounded-full bg-warning/15 px-1.5 py-0.5 text-warning">
                            <TriangleAlertIcon className="size-3" />
                            {gap! > 0 ? `You rated ${gap} higher` : `You rated ${Math.abs(gap!)} lower`}
                          </span>
                        )}
                      </p>
                      {ref.comment && <p className="text-xs text-muted-foreground">{ref.comment}</p>}
                    </div>
                  )}

                  <Rating value={current.rating} onChange={(rating) => setAnswer(question.id, { rating })} />

                  <textarea
                    rows={2}
                    value={current.comment}
                    onChange={(event) => setAnswer(question.id, { comment: event.target.value })}
                    placeholder={
                      question.requiresComment ? "Evidence (required for this question)" : "Comments / evidence"
                    }
                    className={cn(
                      "w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
                      needsEvidence && "border-warning"
                    )}
                  />
                  {needsEvidence && (
                    <p className="flex items-center gap-1.5 text-xs text-warning">
                      <TriangleAlertIcon className="size-3.5" />
                      A rating of {current.rating} needs evidence.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <section className="overflow-hidden rounded-xl border bg-card shadow-2xs">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">In your own words</h3>
          <p className="text-xs text-muted-foreground">Achievements, strengths, and what comes next.</p>
        </div>
        <div className="grid gap-3.5 p-4">
          {NARRATIVE_FIELDS.map((field) => (
            <div key={field.key} className="grid gap-1.5">
              <label htmlFor={`narrative-${field.key}`} className="text-sm font-medium">
                {field.label}
              </label>
              <textarea
                id={`narrative-${field.key}`}
                rows={2}
                value={narrative[field.key]}
                onChange={(event) => setNarrative((prev) => ({ ...prev, [field.key]: event.target.value }))}
                placeholder={field.placeholder}
                className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {missingEvidence > 0 && (
          <p className="mr-auto flex items-center gap-1.5 text-xs text-warning">
            <TriangleAlertIcon className="size-3.5" />
            {missingEvidence} rating{missingEvidence === 1 ? "" : "s"} still need evidence.
          </p>
        )}
        {onSaveDraft && (
          <Button variant="outline" disabled={isPending} onClick={() => onSaveDraft(buildPayload())}>
            Save draft
          </Button>
        )}
        <Button
          className="bg-role-hr text-role-hr-foreground shadow-2xs hover:bg-role-hr/90"
          disabled={isPending || missingEvidence > 0}
          onClick={() => onSubmit(buildPayload())}
        >
          {isPending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </div>
  )
}

"use client"

import { useMemo, useState } from "react"
import { TriangleAlertIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LensBadge } from "@/features/appraisals/components/appraisal-badges"
import { NARRATIVE_FIELDS, type NarrativeKey } from "@/features/appraisals/constants"
import {
  QuestionAnswer,
  EMPTY_ANSWER,
  needsEvidence,
  type AnswerValue,
} from "@/features/appraisals/components/question-answer"
import type { AppraisalDetail, AppraisalRevision } from "@/types/appraisals"

type AnswerState = Record<string, AnswerValue>
type NarrativeState = Record<NarrativeKey, string>

const EMPTY_NARRATIVE: NarrativeState = {
  summary: "", achievements: "", strengths: "", improvementAreas: "", trainingNeeds: "", nextPeriodGoals: "",
}

/**
 * A REVIEWER's version: one page, because a manager works through an employee's
 * appraisal in a single sitting with the self-appraisal open beside it, and
 * breaking that comparison across steps would only get in the way.
 *
 * The employee's own self-appraisal is the step-by-step SelfAppraisalWizard
 * instead. Both render the same QuestionAnswer, so the scale and the evidence
 * rule are one implementation.
 *
 * `reference` is the revision shown READ-ONLY alongside the inputs: for a
 * manager that is the employee's own self-appraisal, so the two sit side by
 * side and are never merged into a single value.
 */
export function RevisionForm({
  appraisal,
  reference,
  submitLabel,
  isPending,
  onSubmit,
}: {
  appraisal: AppraisalDetail
  reference?: AppraisalRevision
  submitLabel: string
  isPending: boolean
  onSubmit: (payload: { answers: unknown[]; narrative: NarrativeState }) => void
}) {
  const categories = appraisal.template.categories
  const [answers, setAnswers] = useState<AnswerState>({})
  // Always blank: every revision is its own author's words. A reviewer writing
  // V2 does not start from the employee's V1 text.
  const [narrative, setNarrative] = useState<NarrativeState>({ ...EMPTY_NARRATIVE })

  const referenceAnswers = useMemo(() => {
    const map: Record<string, { rating: number | null; comment: string | null }> = {}
    reference?.answers.forEach((answer) => {
      map[String(answer.appraisalTemplateQuestionId)] = { rating: answer.rating, comment: answer.comment }
    })
    return map
  }, [reference])

  function setAnswer(questionId: string, patch: Partial<AnswerValue>) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...EMPTY_ANSWER, ...prev[questionId], ...patch },
    }))
  }

  const missingEvidence = useMemo(
    () => Object.values(answers).filter(needsEvidence).length,
    [answers]
  )

  function buildPayload() {
    return {
      answers: Object.entries(answers)
        .filter(([, answer]) => answer.rating != null || answer.comment.trim())
        .map(([questionId, answer]) => ({ questionId, rating: answer.rating, comment: answer.comment })),
      narrative,
    }
  }

  return (
    <div className="grid gap-4">
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
            {category.questions.map((question) => (
              <QuestionAnswer
                key={question.id}
                question={question}
                value={answers[question.id] ?? EMPTY_ANSWER}
                onChange={(patch) => setAnswer(question.id, patch)}
                reference={referenceAnswers[String(question.id)]}
                referenceLabel={`${reference?.label} · ${reference?.authorName}`}
              />
            ))}
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

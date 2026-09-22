"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "cn"
import {
  ArrowLeftIcon, ArrowRightIcon, CheckIcon, CloudIcon, PencilIcon, TriangleAlertIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LensBadge } from "@/features/appraisals/components/appraisal-badges"
import { SelfAppraisalImport } from "@/features/appraisals/components/self-appraisal-import"
import {
  QuestionAnswer, EMPTY_ANSWER, needsEvidence, type AnswerValue,
} from "@/features/appraisals/components/question-answer"
import {
  APPRAISAL_LENSES, NARRATIVE_FIELDS, RATING_SCALE, type NarrativeKey,
} from "@/features/appraisals/constants"
import { useSaveSelfAppraisalDraft, useSubmitSelfAppraisal } from "@/features/appraisals/hooks/use-appraisal-mutations"
import type { AppraisalDetail, AppraisalLens, ImportPreviewRow } from "@/types/appraisals"

type AnswerState = Record<string, AnswerValue>
type NarrativeState = Record<NarrativeKey, string>

const EMPTY_NARRATIVE: NarrativeState = {
  summary: "", achievements: "", strengths: "", improvementAreas: "", trainingNeeds: "", nextPeriodGoals: "",
}

/**
 * The steps, in order. Step 1 is the configured performance areas, step 2 is
 * the three lenses those areas roll up into, then the employee's own words,
 * then a full review before anything is submitted.
 */
const STEPS = [
  { key: "areas", title: "Performance areas", hint: "Rate each area and back it up with evidence." },
  { key: "lenses", title: "Performance perspectives", hint: "How your ratings land across the three lenses." },
  { key: "story", title: "Your year in your words", hint: "The summary a reviewer reads first." },
  { key: "ahead", title: "Looking ahead", hint: "Where you want to grow and what would help." },
  { key: "review", title: "Review & submit", hint: "Everything you've entered, in one place." },
] as const

/** Which narrative fields belong to which step. */
const STORY_FIELDS: NarrativeKey[] = ["summary", "achievements", "strengths"]
const AHEAD_FIELDS: NarrativeKey[] = ["improvementAreas", "trainingNeeds", "nextPeriodGoals"]

function ratingLabel(rating: number | null) {
  return RATING_SCALE.find((option) => option.value === rating)?.label ?? "Not rated"
}

function NarrativeInput({
  field,
  value,
  onChange,
}: {
  field: (typeof NARRATIVE_FIELDS)[number]
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={`narrative-${field.key}`} className="text-sm font-medium">
        {field.label}
      </label>
      <textarea
        id={`narrative-${field.key}`}
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      />
    </div>
  )
}

/**
 * The employee's own self-appraisal, taken one step at a time (§10).
 *
 * Every step saves a DRAFT — mutable, unversioned and private to its author.
 * It is deliberately not a revision: a revision is immutable and numbered, so
 * saving at each step would otherwise mint a V-number per keystroke-pause and
 * bury the history a Final Reviewer has to read. Only "Submit" creates V1, and
 * from that point the existing locking and versioning take over unchanged.
 */
export function SelfAppraisalWizard({ appraisal }: { appraisal: AppraisalDetail }) {
  const categories = appraisal.template.categories
  const draft = appraisal.selfAppraisalDraft
  const submitSelf = useSubmitSelfAppraisal(appraisal.id)
  const saveDraft = useSaveSelfAppraisalDraft(appraisal.id)

  // Seeded ONCE from the saved draft. Re-seeding on every fetch would fight
  // the person typing, since each save refetches the appraisal.
  const [answers, setAnswers] = useState<AnswerState>(() => {
    const seeded: AnswerState = {}
    draft?.answers?.forEach((answer) => {
      seeded[String(answer.questionId)] = { rating: answer.rating, comment: answer.comment ?? "" }
    })
    return seeded
  })
  const [narrative, setNarrative] = useState<NarrativeState>(() => ({ ...EMPTY_NARRATIVE, ...draft?.narrative }))
  const [step, setStep] = useState(() => {
    const resumed = (draft?.step ?? 0) - 1
    return resumed > 0 && resumed < STEPS.length ? resumed : 0
  })
  const [savedAt, setSavedAt] = useState<string | null>(draft?.savedAt ?? null)
  const topRef = useRef<HTMLDivElement>(null)

  function setAnswer(questionId: string, patch: Partial<AnswerValue>) {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...EMPTY_ANSWER, ...prev[questionId], ...patch } }))
  }

  function applyImported(rows: ImportPreviewRow[]) {
    setAnswers((prev) => {
      const next = { ...prev }
      rows.forEach((row) => {
        next[String(row.questionId)] = { rating: row.rating, comment: row.comment ?? "" }
      })
      return next
    })
  }

  const answerPayload = useMemo(
    () =>
      Object.entries(answers)
        .filter(([, answer]) => answer.rating != null || answer.comment.trim())
        .map(([questionId, answer]) => ({ questionId, rating: answer.rating, comment: answer.comment })),
    [answers]
  )

  const missingEvidence = useMemo(() => Object.values(answers).filter(needsEvidence).length, [answers])
  const allQuestions = useMemo(() => categories.flatMap((category) => category.questions), [categories])
  const unanswered = allQuestions.filter((question) => (answers[question.id]?.rating ?? null) == null).length

  /**
   * Each lens, its configured weight and how the employee's own ratings sit
   * inside it. Derived from what they entered — nothing here is a separate
   * field to fill in, because the lenses ARE the categories rolled up.
   */
  const lensRollup = useMemo(
    () =>
      APPRAISAL_LENSES.map((lens) => {
        const inLens = categories.filter((category) => category.lens === (lens.value as AppraisalLens))
        const weight = inLens.reduce((sum, category) => sum + Number(category.weight), 0)
        const rated = inLens
          .flatMap((category) => category.questions)
          .map((question) => answers[question.id]?.rating)
          .filter((rating): rating is number => rating != null)
        const average = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null
        return { ...lens, categories: inLens, weight, average, ratedCount: rated.length }
      }).filter((lens) => lens.categories.length > 0),
    [categories, answers]
  )

  function persist(nextStep: number) {
    saveDraft.mutate(
      { step: nextStep + 1, answers: answerPayload, ...narrative },
      { onSuccess: () => setSavedAt(new Date().toISOString()) }
    )
  }

  function goTo(nextStep: number) {
    const target = Math.max(0, Math.min(STEPS.length - 1, nextStep))
    // Saving on every move is what makes stepping backwards to edit safe:
    // nothing is lost by leaving a step, whichever direction you leave it in.
    persist(target)
    setStep(target)
  }

  // Bringing the top of the step into view is a nicety, and it is guarded
  // because scrollIntoView is not universally available — jsdom has no such
  // method at all, and an unguarded call there takes the whole form down.
  useEffect(() => {
    topRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" })
  }, [step])

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="grid gap-4" ref={topRef}>
      {/* Progress. The plain "Step X of Y" is spelled out rather than left to
          the reader to count off the dots. */}
      <div className="grid gap-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">
            Step {step + 1} of {STEPS.length} · {current.title}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {saveDraft.isPending ? (
              <>
                <CloudIcon className="size-3.5 animate-pulse" /> Saving…
              </>
            ) : savedAt ? (
              <>
                <CheckIcon className="size-3.5 text-success" /> Draft saved{" "}
                {new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </>
            ) : (
              "Nothing saved yet"
            )}
          </p>
        </div>

        <ol className="flex flex-wrap gap-1.5">
          {STEPS.map((definition, index) => {
            const done = index < step
            const active = index === step
            return (
              <li key={definition.key} className="flex-1">
                <button
                  type="button"
                  // Backwards only: a step you haven't reached can't be
                  // meaningfully reviewed yet, and Next is the way forward.
                  disabled={index > step}
                  aria-current={active ? "step" : undefined}
                  onClick={() => goTo(index)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                    active && "border-role-hr bg-role-hr/8",
                    done && "border-success/40 bg-success/5 hover:bg-success/10",
                    index > step && "cursor-not-allowed opacity-55"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                      active
                        ? "bg-role-hr text-role-hr-foreground"
                        : done
                          ? "bg-success text-success-foreground"
                          : "border text-muted-foreground"
                    )}
                  >
                    {done ? <CheckIcon className="size-3.5" /> : index + 1}
                  </span>
                  <span className="min-w-0 text-xs font-medium">{definition.title}</span>
                </button>
              </li>
            )
          })}
        </ol>
        <p className="text-xs text-muted-foreground">{current.hint}</p>
      </div>

      {current.key === "areas" && (
        <div className="grid gap-4">
          <SelfAppraisalImport appraisalId={appraisal.id} onConfirm={applyImported} />

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
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {current.key === "lenses" && (
        <div className="grid gap-3">
          <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
            Your appraisal looks at three things at once: what you delivered, what you can do now, and what you are
            ready for next. The weights come from the template — nothing to fill in here, this is your own ratings
            seen through those three lenses.
          </p>

          {lensRollup.map((lens) => (
            <section key={lens.value} className="overflow-hidden rounded-xl border bg-card shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <LensBadge lens={lens.value as AppraisalLens} />
                  <span className="text-xs text-muted-foreground">
                    {lens.weight}% of this appraisal
                    {lens.weight !== lens.targetWeight && ` (standard split is ${lens.targetWeight}%)`}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-lg leading-tight font-semibold tabular-nums">
                    {lens.average != null ? lens.average.toFixed(1) : "—"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {lens.ratedCount > 0 ? "your average so far" : "not rated yet"}
                  </p>
                </div>
              </div>
              <ul className="grid gap-2 p-4">
                {lens.categories.map((category) => (
                  <li key={category.id} className="grid gap-1.5 rounded-lg border p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{category.name}</p>
                      <Badge variant="outline" className="tabular-nums">
                        {Number(category.weight)}%
                      </Badge>
                    </div>
                    {category.questions.map((question) => (
                      <div key={question.id} className="flex items-start justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">{question.prompt}</span>
                        <span className="shrink-0 font-medium tabular-nums">
                          {answers[question.id]?.rating ?? "—"}
                        </span>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {current.key === "story" && (
        <section className="grid gap-3.5 rounded-xl border bg-card p-4 shadow-2xs">
          {NARRATIVE_FIELDS.filter((field) => STORY_FIELDS.includes(field.key)).map((field) => (
            <NarrativeInput
              key={field.key}
              field={field}
              value={narrative[field.key]}
              onChange={(next) => setNarrative((prev) => ({ ...prev, [field.key]: next }))}
            />
          ))}
        </section>
      )}

      {current.key === "ahead" && (
        <section className="grid gap-3.5 rounded-xl border bg-card p-4 shadow-2xs">
          {NARRATIVE_FIELDS.filter((field) => AHEAD_FIELDS.includes(field.key)).map((field) => (
            <NarrativeInput
              key={field.key}
              field={field}
              value={narrative[field.key]}
              onChange={(next) => setNarrative((prev) => ({ ...prev, [field.key]: next }))}
            />
          ))}
        </section>
      )}

      {current.key === "review" && (
        <div className="grid gap-3">
          <div
            className={cn(
              "flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3 text-sm",
              missingEvidence > 0 || unanswered > 0
                ? "border-warning/40 bg-warning/5 text-warning"
                : "border-success/40 bg-success/5 text-success"
            )}
          >
            {missingEvidence > 0 || unanswered > 0 ? (
              <>
                <TriangleAlertIcon className="size-4" />
                <span>
                  {unanswered > 0 && `${unanswered} question${unanswered === 1 ? "" : "s"} still unrated`}
                  {unanswered > 0 && missingEvidence > 0 && " · "}
                  {missingEvidence > 0 &&
                    (missingEvidence === 1
                      ? "1 rating needs evidence"
                      : `${missingEvidence} ratings need evidence`)}
                </span>
              </>
            ) : (
              <>
                <CheckIcon className="size-4" />
                <span>Everything is filled in. Read it through, then submit.</span>
              </>
            )}
          </div>

          <section className="overflow-hidden rounded-xl border bg-card shadow-2xs">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <h3 className="text-sm font-semibold">Your ratings</h3>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => goTo(0)}>
                <PencilIcon className="size-3.5" /> Edit
              </Button>
            </div>
            <div className="grid gap-3 p-4">
              {categories.map((category) => (
                <div key={category.id} className="grid gap-1.5">
                  <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    {category.name}
                    <LensBadge lens={category.lens} />
                  </p>
                  {category.questions.map((question) => {
                    const answer = answers[question.id] ?? EMPTY_ANSWER
                    return (
                      <div key={question.id} className="grid gap-0.5 rounded-lg border p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm">{question.prompt}</p>
                          <Badge
                            variant="outline"
                            className={cn("shrink-0 tabular-nums", answer.rating == null && "text-warning")}
                          >
                            {answer.rating ?? "—"}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{ratingLabel(answer.rating)}</p>
                        {answer.comment.trim() ? (
                          <p className="mt-1 text-xs whitespace-pre-wrap">{answer.comment}</p>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground italic">No evidence added</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border bg-card shadow-2xs">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <h3 className="text-sm font-semibold">Perspectives</h3>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => goTo(1)}>
                <PencilIcon className="size-3.5" /> View
              </Button>
            </div>
            <ul className="grid gap-2 p-4 sm:grid-cols-3">
              {lensRollup.map((lens) => (
                <li key={lens.value} className="grid gap-1 rounded-lg border p-2.5">
                  <LensBadge lens={lens.value as AppraisalLens} />
                  <p className="text-lg leading-tight font-semibold tabular-nums">
                    {lens.average != null ? lens.average.toFixed(1) : "—"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{lens.weight}% weight</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="overflow-hidden rounded-xl border bg-card shadow-2xs">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <h3 className="text-sm font-semibold">In your own words</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => goTo(2)}>
                  <PencilIcon className="size-3.5" /> Edit
                </Button>
              </div>
            </div>
            <div className="grid gap-2 p-4">
              {NARRATIVE_FIELDS.map((field) => (
                <div key={field.key} className="grid gap-0.5 rounded-lg border p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-muted-foreground">{field.label}</p>
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground underline"
                      onClick={() => goTo(STORY_FIELDS.includes(field.key) ? 2 : 3)}
                    >
                      Edit
                    </button>
                  </div>
                  {narrative[field.key].trim() ? (
                    <p className="text-sm whitespace-pre-wrap">{narrative[field.key]}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Left blank</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <p className="text-xs text-muted-foreground">
            Submitting creates version 1 of your appraisal and sends it to{" "}
            {appraisal.managers.primary?.fullName ?? "your primary manager"}. After that it is locked, and any change
            has to come back to you as a correction.
          </p>
        </div>
      )}

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t bg-background/95 py-3 backdrop-blur">
        <Button variant="outline" className="gap-1.5" disabled={step === 0} onClick={() => goTo(step - 1)}>
          <ArrowLeftIcon className="size-4" /> Back
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" disabled={saveDraft.isPending} onClick={() => persist(step)}>
            Save draft
          </Button>
          {isLast ? (
            <Button
              className="gap-1.5 bg-role-hr text-role-hr-foreground shadow-2xs hover:bg-role-hr/90"
              disabled={submitSelf.isPending || missingEvidence > 0}
              onClick={() => submitSelf.mutate({ answers: answerPayload, ...narrative })}
            >
              {submitSelf.isPending ? "Submitting…" : "Submit self-appraisal"}
              <CheckIcon className="size-4" />
            </Button>
          ) : (
            <Button
              className="gap-1.5 bg-role-hr text-role-hr-foreground shadow-2xs hover:bg-role-hr/90"
              onClick={() => goTo(step + 1)}
            >
              Next <ArrowRightIcon className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

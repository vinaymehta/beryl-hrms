"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "cn"
import {
  ArrowLeftIcon, ArrowRightIcon, CheckIcon, CloudIcon, PencilIcon, TriangleAlertIcon,
  ClockIcon, LightbulbIcon, SparklesIcon, TargetIcon, WrenchIcon, type LucideIcon,
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
import type {
  AppraisalDetail, AppraisalLens, ImportPreviewRow, TemplateField, TemplateWizardSection,
} from "@/types/appraisals"

type AnswerState = Record<string, AnswerValue>
type NarrativeState = Record<NarrativeKey, string>

const NARRATIVE_KEYS = NARRATIVE_FIELDS.map((field) => field.key)
const isNarrativeKey = (key: string): key is NarrativeKey =>
  (NARRATIVE_KEYS as string[]).includes(key)

const EMPTY_NARRATIVE: NarrativeState = {
  summary: "", achievements: "", strengths: "", improvementAreas: "", trainingNeeds: "", nextPeriodGoals: "",
}

/**
 * The steps, in order. Step 1 is the configured performance areas, step 2 is
 * the three lenses those areas roll up into, then the employee's own words,
 * then a full review before anything is submitted.
 */
/** Which narrative fields belong to which fallback step — see FALLBACK_SECTIONS. */
const STORY_FIELD_KEYS: NarrativeKey[] = ["summary", "achievements", "strengths"]
const AHEAD_FIELD_KEYS: NarrativeKey[] = ["improvementAreas", "trainingNeeds", "nextPeriodGoals"]

/**
 * The steps that always exist, whatever template is in play: the rated
 * categories at the front and the read-it-through summary at the back.
 * Everything in between is the TEMPLATE's, not the frontend's.
 */
const FIRST_STEP = {
  key: "areas",
  title: "Performance areas",
  caption: "Rate and add your feedback",
  hint: "Rate each area and back it up with evidence.",
} as const

const LAST_STEP = {
  key: "review",
  title: "Review & submit",
  caption: "Check and submit",
  hint: "Everything you've entered, in one place.",
} as const

/**
 * The steps a template with no imported structure gets.
 *
 * Every template built by hand in the builder, and every template that
 * predates the workbook importer, has no `structure` — so the six narrative
 * columns are still the form for them. This is a FALLBACK, not the default:
 * an imported template's steps come from its workbook and never from here.
 */
const FALLBACK_SECTIONS: TemplateWizardSection[] = [
  {
    key: "story",
    kind: "long_text",
    title: "In your words",
    caption: "Overall comments",
    fields: NARRATIVE_FIELDS.filter((field) => STORY_FIELD_KEYS.includes(field.key)).map((field) => ({
      key: field.key,
      label: field.label,
      description: field.placeholder,
    })),
  },
  {
    key: "ahead",
    kind: "long_text",
    title: "Looking ahead",
    caption: "Future focus",
    fields: NARRATIVE_FIELDS.filter((field) => AHEAD_FIELD_KEYS.includes(field.key)).map((field) => ({
      key: field.key,
      label: field.label,
      description: field.placeholder,
    })),
  },
]

/**
 * The wizard's running order for THIS appraisal.
 *
 * An imported template carries its own sections, so renaming a section in the
 * spreadsheet renames the step, adding a field adds an input, and removing one
 * removes it — with no change here. Sections the workbook marks as the
 * reviewer's (the Final Review block) are dropped from the employee's walk.
 */
function stepsFor(template: AppraisalDetail["template"]) {
  const defined = (template.structure?.wizardSections ?? []).filter(
    // The Final Review block is the reviewer's part of the workbook, so it is
    // not a step in the employee's walk through the form.
    (section) => section.audience !== "reviewer" && section.fields.length > 0
  )

  const perspectives =
    defined.find((section) => section.kind === "perspectives") ??
    // A hand-built template has no workbook perspectives, but its categories
    // still carry lenses — so the step is derived rather than dropped, which
    // is how this behaved before templates could be imported at all.
    ({
      key: "lenses",
      kind: "perspectives",
      title: "Perspective",
      caption: "Share your perspective",
      fields: [],
    } satisfies TemplateWizardSection)

  const textSections = defined.filter((section) => section.kind === "long_text")
  const middle = [ perspectives, ...(textSections.length > 0 ? textSections : FALLBACK_SECTIONS) ]

  return [
    { ...FIRST_STEP, section: null as TemplateWizardSection | null },
    ...middle.map((section) => ({
      key: section.key,
      title: section.title,
      caption: section.caption ?? "",
      hint: section.caption ?? "",
      section,
    })),
    { ...LAST_STEP, section: null as TemplateWizardSection | null },
  ]
}

/**
 * An icon per lens, so each performance area card is recognisable at a glance
 * on a long page. Keyed off the lens rather than stored per category: the
 * template has no icon field, and inventing one to hold decoration would put
 * presentation in the database.
 */
const LENS_ICON: Record<AppraisalLens, LucideIcon> = {
  past: TargetIcon,
  current_capability: WrenchIcon,
  future_readiness: SparklesIcon,
}

/** The length the evidence box is sized for. A guide, not a limit — see below. */
const EVIDENCE_GUIDE_LENGTH = 1000

const APPRAISAL_TIPS = [
  "Be specific and use real examples",
  "Focus on outcomes and impact",
  "Be honest and constructive",
  "Consider both achievements and areas for growth",
]

function formatDeadline(date: string | null) {
  if (!date) return null
  return new Date(date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

/** A ring showing how much of the form is done. */
function ProgressRing({ percent }: { percent: number }) {
  const radius = 26
  const circumference = 2 * Math.PI * radius
  return (
    <svg viewBox="0 0 64 64" className="size-16 shrink-0 -rotate-90" aria-hidden>
      <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="6" className="stroke-muted" />
      <circle
        cx="32"
        cy="32"
        r={radius}
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        className="stroke-role-hr transition-[stroke-dashoffset] duration-500"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - percent / 100)}
      />
    </svg>
  )
}


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

/** One template-defined free-text field. */
function TemplateFieldInput({
  field,
  value,
  onChange,
}: {
  field: TemplateField
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={`field-${field.key}`} className="text-sm font-medium">
        {field.label}
      </label>
      {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
      <textarea
        id={`field-${field.key}`}
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
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
  /** Answers to the TEMPLATE's own fields, keyed by the workbook's field key. */
  const [responses, setResponses] = useState<Record<string, string>>(() => ({ ...draft?.responses }))

  // Derived from the template, so a re-imported workbook changes the steps.
  const STEPS = useMemo(() => stepsFor(appraisal.template), [appraisal.template])
  const [step, setStep] = useState(() => Math.max(0, (draft?.step ?? 1) - 1))
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

  /**
   * Each performance area's own standing: its average rating, and whether the
   * employee has finished with it. An area counts as done only when every
   * question in it is rated — a half-rated area is not one you can stop
   * thinking about, so counting it would overstate the progress.
   */
  const areaProgress = useMemo(
    () =>
      categories.map((category) => {
        const ratings = category.questions
          .map((question) => answers[question.id]?.rating)
          .filter((rating): rating is number => rating != null)
        const complete = ratings.length === category.questions.length && category.questions.length > 0
        return {
          category,
          average: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
          complete,
        }
      }),
    [categories, answers]
  )

  const completedAreas = areaProgress.filter((area) => area.complete).length
  const percentComplete = categories.length ? Math.round((completedAreas / categories.length) * 100) : 0

  /**
   * The score this appraisal is heading for, weighted by each area's configured
   * weight and computed over the RATED areas only — an unrated area is absent
   * from the estimate rather than counted as a zero, which would show a number
   * that drops the moment you start and climbs as you finish.
   */
  const estimatedScore = useMemo(() => {
    const rated = areaProgress.filter((area) => area.average != null)
    const totalWeight = rated.reduce((sum, area) => sum + Number(area.category.weight), 0)
    if (!totalWeight) return null
    const weighted = rated.reduce((sum, area) => sum + area.average! * Number(area.category.weight), 0)
    return weighted / totalWeight
  }, [areaProgress])

  /**
   * Read and write a field by key, whichever store it belongs in.
   *
   * The six fixed narrative keys still land in their own columns, so a
   * hand-built template and every revision already written against it behave
   * exactly as before. Anything else is a workbook-defined field and goes to
   * `responses`, which is what makes an added or renamed prompt storable at
   * all without a migration.
   */
  function valueOf(key: string) {
    return isNarrativeKey(key) ? narrative[key] : (responses[key] ?? "")
  }

  function setFieldValue(key: string, next: string) {
    if (isNarrativeKey(key)) {
      setNarrative((prev) => ({ ...prev, [key]: next }))
    } else {
      setResponses((prev) => ({ ...prev, [key]: next }))
    }
  }

  function persist(nextStep: number) {
    saveDraft.mutate(
      { step: nextStep + 1, answers: answerPayload, responses, ...narrative },
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

  // Clamped rather than trusted: a saved draft's step number was recorded
  // against the template as it was, and a re-import can leave fewer steps.
  const textSteps = STEPS.flatMap((definition, index) =>
    definition.section?.kind === "long_text" ? [ { index, section: definition.section } ] : []
  )
  const stepIndex = Math.min(step, STEPS.length - 1)
  const current = STEPS[stepIndex]
  const isLast = stepIndex === STEPS.length - 1
  const deadline = formatDeadline(appraisal.cycle.employeeSubmissionDeadline)

  const saveStatus = saveDraft.isPending ? (
    <>
      <CloudIcon className="size-3.5 animate-pulse" /> Saving…
    </>
  ) : savedAt ? (
    <>
      <CheckIcon className="size-3.5 text-success" /> Draft saved{" "}
      {new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </>
  ) : (
    <>
      <CloudIcon className="size-3.5" /> Nothing saved yet
    </>
  )

  const primaryAction = isLast ? (
    <Button
      className="w-full gap-1.5 bg-role-hr text-role-hr-foreground shadow-2xs hover:bg-role-hr/90"
      disabled={submitSelf.isPending || missingEvidence > 0}
      onClick={() => submitSelf.mutate({ answers: answerPayload, responses, ...narrative })}
    >
      {submitSelf.isPending ? "Submitting…" : "Submit self-appraisal"}
      <CheckIcon className="size-4" />
    </Button>
  ) : (
    <Button
      className="w-full gap-1.5 bg-role-hr text-role-hr-foreground shadow-2xs hover:bg-role-hr/90"
      onClick={() => goTo(stepIndex + 1)}
    >
      Continue to next step <ArrowRightIcon className="size-4" />
    </Button>
  )

  return (
    <div className="grid gap-4" ref={topRef}>
      {/* Title row. The cycle names the appraisal, and the submission deadline
          sits next to it rather than buried further down — it is the one fact
          that changes what you do today. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl leading-tight font-semibold tracking-tight">{appraisal.cycle.name}</h2>
          <p className="text-sm text-muted-foreground">
            Share your feedback across the performance areas below. Be honest, specific, and use examples where
            possible.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {deadline && (
            <span className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
              <ClockIcon className="size-3.5" /> Due {deadline}
            </span>
          )}
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{saveStatus}</p>
        </div>
      </div>

      {/* Numbered stepper. Each step carries a caption as well as a name, so
          "Perspective" and "In your words" say what they want before you get
          there. "Step X of Y" stays spelled out for anyone who would otherwise
          have to count the circles. */}
      <div className="grid gap-2">
        <ol className="flex flex-wrap items-stretch gap-x-2 gap-y-3">
          {STEPS.map((definition, index) => {
            const done = index < stepIndex
            const active = index === stepIndex
            return (
              <li key={definition.key} className="flex h-11 min-w-fit flex-1 items-center gap-2">
                <button
                  type="button"
                  // Backwards only: a step you haven't reached can't be
                  // meaningfully reviewed yet, and Continue is the way forward.
                  disabled={index > stepIndex}
                  aria-current={active ? "step" : undefined}
                  onClick={() => goTo(index)}
                  className={cn(
                    "flex h-full shrink-0 items-center gap-2 rounded-lg px-1.5 text-left transition-colors",
                    index > stepIndex ? "cursor-not-allowed opacity-55" : "hover:bg-muted/60"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-colors",
                      active
                        ? "border-role-hr bg-role-hr text-role-hr-foreground ring-4 ring-role-hr/15"
                        : done
                          ? "border-success bg-success text-success-foreground"
                          : "border-muted-foreground/30 bg-card text-muted-foreground"
                    )}
                  >
                    {done ? <CheckIcon className="size-3.5" /> : index + 1}
                  </span>
                  <span className="flex flex-col justify-center whitespace-nowrap leading-tight">
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        active ? "text-role-hr" : "text-foreground"
                      )}
                    >
                      {definition.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{definition.caption}</span>
                  </span>
                </button>
                {index < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className={cn(
                      "hidden h-px min-w-3 flex-1 self-center sm:block",
                      done ? "bg-success/60" : "bg-border"
                    )}
                  />
                )}
              </li>
            )
          })}
        </ol>
      </div>

      {/* Form on the left, standing on the right. The summary is what turns a
          long scroll into something you can judge your progress against, so it
          sticks rather than scrolling away with the areas it describes. */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)]">
        <div className="grid min-w-0 gap-4">
          <p className="sr-only">
            Step {stepIndex + 1} of {STEPS.length} · {current.title} — {current.hint}
          </p>

      {current.key === "areas" && (
        <div className="grid gap-4 rounded-xl border bg-card p-4 shadow-2xs">
          {/* One titled section holding the areas, with the workbook route in
              its header rather than as a separate dashed panel above — the
              spreadsheet is an alternative way to fill THIS section in, not a
              thing in its own right. */}
          {/* The workbook buttons belong on the heading's row, not stacked
              under it — `flex-wrap` alone dropped them onto a second line as
              soon as the column narrowed. */}
          <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3 sm:flex-nowrap">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-foreground">Performance areas</h3>
              <p className="text-sm text-muted-foreground">
                Rate each area and provide evidence or examples to support your ratings.
              </p>
            </div>
            <div className="shrink-0">
              <SelfAppraisalImport appraisalId={appraisal.id} onConfirm={applyImported} compact />
            </div>
          </div>

          {categories.map((category) => {
            const Icon = LENS_ICON[category.lens]
            return (
              <section key={category.id} className="rounded-xl border bg-card p-4 shadow-2xs">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-role-hr/10 text-role-hr">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      {/* Full description, not truncated: it is the brief for
                          the rating being asked for, so hiding it behind an
                          ellipsis defeats the point of having written it. */}
                      <h3 className="text-base font-semibold text-foreground">{category.name}</h3>
                      <Badge variant="outline" className="shrink-0 tabular-nums">
                        {Number(category.weight)}%
                      </Badge>
                    </div>
                    {category.description && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{category.description}</p>
                    )}
                  </div>
                </div>

                <div className="mt-3.5 grid gap-4">
                  {category.questions.map((question) => (
                    <QuestionAnswer
                      key={question.id}
                      question={question}
                      value={answers[question.id] ?? EMPTY_ANSWER}
                      onChange={(patch) => setAnswer(question.id, patch)}
                      // One question per area is the common shape, and repeating
                      // the area's own name above its only question just reads
                      // as a stutter.
                      hidePrompt={category.questions.length === 1 && question.prompt === category.name}
                      guideLength={EVIDENCE_GUIDE_LENGTH}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {current.section?.kind === "perspectives" && (
        <div className="grid gap-3">
          <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
            Nothing to fill in here — these are your own ratings seen through the perspectives this template
            defines, at the weights it sets.
          </p>

          {/* The workbook's own perspective definitions, when the template was
              imported from one. Their names, weights and assessment focus are
              read from the template, so changing them in the spreadsheet
              changes what is shown here. */}
          {current.section.fields.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-3">
              {current.section.fields.map((field) => (
                <li key={field.key} className="grid gap-1 rounded-xl border bg-card p-3 shadow-2xs">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{field.label}</p>
                    {field.weight != null && (
                      <Badge variant="outline" className="shrink-0 tabular-nums">
                        {field.weight}%
                      </Badge>
                    )}
                  </div>
                  {field.description && (
                    <p className="text-xs text-muted-foreground">{field.description}</p>
                  )}
                </li>
              ))}
            </ul>
          )}

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

      {/* Every free-text step, whatever the template calls it and whatever it
          asks. One renderer, driven by the section's own field list — there is
          no branch here for "your year in your words" or "looking ahead". */}
      {current.section?.kind === "long_text" && (
        <section className="grid gap-3.5 rounded-xl border bg-card p-4 shadow-2xs">
          {current.section.fields.map((field) => (
            <TemplateFieldInput
              key={field.key}
              field={field}
              value={valueOf(field.key)}
              onChange={(next) => setFieldValue(field.key, next)}
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
            </div>
            {/* Grouped by the template's own sections, so the review reads
                back exactly the questions that were asked — including their
                wording and their order. */}
            <div className="grid gap-3 p-4">
              {textSteps.map(({ index: stepNumber, section }) => (
                <div key={section.key} className="grid gap-2">
                  <p className="flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
                    {section.title}
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => goTo(stepNumber)}>
                      <PencilIcon className="size-3.5" /> Edit
                    </Button>
                  </p>
                  {section.fields.map((field) => (
                    <div key={field.key} className="grid gap-0.5 rounded-lg border p-2.5">
                      <p className="text-[11px] font-semibold text-muted-foreground">{field.label}</p>
                      {valueOf(field.key).trim() ? (
                        <p className="text-sm whitespace-pre-wrap">{valueOf(field.key)}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Left blank</p>
                      )}
                    </div>
                  ))}
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

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <Button variant="outline" className="gap-1.5" disabled={stepIndex === 0} onClick={() => goTo(stepIndex - 1)}>
              <ArrowLeftIcon className="size-4" /> Back
            </Button>
            <Button variant="ghost" disabled={saveDraft.isPending} onClick={() => persist(stepIndex)}>
              Save draft
            </Button>
          </div>
        </div>

        {/* The standing summary. Everything in it is derived from what has
            been entered — there is nothing to fill in here. */}
        <aside className="grid gap-3 lg:sticky lg:top-4">
          <section className="grid gap-3 rounded-xl border bg-card p-4 shadow-2xs">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-role-hr/12 text-role-hr">
                <TargetIcon className="size-3.5" />
              </span>
              Your progress
            </h3>
            <div className="flex items-center gap-3">
              <div className="relative flex shrink-0 items-center justify-center">
                <ProgressRing percent={percentComplete} />
                <span className="absolute text-xs font-semibold tabular-nums">{percentComplete}%</span>
              </div>
              <div className="min-w-0">
                <p className="text-lg leading-tight font-semibold tabular-nums">
                  {completedAreas} of {categories.length}
                </p>
                <p className="text-xs text-muted-foreground">areas completed</p>
              </div>
            </div>
          </section>

          <section className="grid gap-2 rounded-xl border bg-card p-4 shadow-2xs">
            <h3 className="text-sm font-semibold">Selected ratings</h3>
            <ul className="grid gap-1.5">
              {areaProgress.map(({ category, average }) => {
                const Icon = LENS_ICON[category.lens]
                return (
                  <li key={category.id} className="flex items-center gap-2 text-xs">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon className="size-3" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{category.name}</span>
                    {average == null ? (
                      <span className="shrink-0 text-muted-foreground">Not rated</span>
                    ) : (
                      <span className="shrink-0 font-semibold tabular-nums">
                        {Number.isInteger(average) ? average : average.toFixed(1)}{" "}
                        <span className="font-normal text-muted-foreground">/ 5</span>
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>

            <div className="mt-1 grid gap-1.5 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground">Estimated overall score</p>
              <p className="text-2xl leading-none font-bold tabular-nums">
                {estimatedScore == null ? "—" : estimatedScore.toFixed(1)}
                <span className="text-base font-normal text-muted-foreground"> / 5</span>
              </p>
              <p className="text-[11px] text-muted-foreground">Based on completed ratings (weighted)</p>
              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-role-hr transition-[width] duration-500"
                  style={{ width: `${estimatedScore == null ? 0 : (estimatedScore / 5) * 100}%` }}
                />
              </div>
            </div>
          </section>

          <div className="grid gap-1.5">
            {primaryAction}
            <p className="text-center text-[11px] text-muted-foreground">
              Your progress is saved automatically
            </p>
          </div>

          <section className="grid gap-2 rounded-xl bg-role-hr/5 p-4 ring-1 ring-role-hr/15">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <LightbulbIcon className="size-4 text-role-hr" />
              Tips for a great appraisal
            </h3>
            <ul className="grid gap-1.5">
              {APPRAISAL_TIPS.map((tip) => (
                <li key={tip} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-role-hr" />
                  {tip}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}

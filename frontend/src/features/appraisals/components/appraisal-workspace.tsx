"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeftIcon, ArrowRightIcon, CalendarDaysIcon, CheckIcon, CloudIcon, GaugeIcon,
  HistoryIcon, LightbulbIcon, MessageSquareIcon, NetworkIcon, PencilLineIcon, ShieldIcon, TargetIcon,
  TriangleAlertIcon, UsersRoundIcon, type LucideIcon,
} from "lucide-react"
import { cn } from "cn"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AppraisalStatusBadge } from "@/features/appraisals/components/appraisal-badges"
import { AppraisalWorkflowTimeline } from "@/features/appraisals/components/appraisal-workflow-timeline"
import { PerformanceAreaList } from "@/features/appraisals/components/performance-area-list"
import { RatingSelect, RatingGuide } from "@/features/appraisals/components/rating-select"
import { RevisionHistory } from "@/features/appraisals/components/revision-history"
import { AppraisalComments } from "@/features/appraisals/components/appraisal-comments"
import { CompensationPanel } from "@/features/appraisals/components/compensation-panel"
import { FeedbackRequestsPanel } from "@/features/appraisals/components/feedback-requests-panel"
import { SelfAppraisalImport } from "@/features/appraisals/components/self-appraisal-import"
import { EMPTY_ANSWER, needsEvidence, type AnswerValue } from "@/features/appraisals/components/question-answer"
import { APPRAISAL_LENSES, NARRATIVE_FIELDS, type NarrativeKey } from "@/features/appraisals/constants"
import { useSaveSelfAppraisalDraft, useSubmitSelfAppraisal, useSubmitReview } from "@/features/appraisals/hooks/use-appraisal-mutations"
import type {
  AppraisalDetail, AppraisalLens, ImportPreviewRow, TemplateField, TemplateWizardSection,
} from "@/types/appraisals"

type AnswerState = Record<string, AnswerValue>
type NarrativeState = Record<NarrativeKey, string>

const EMPTY_NARRATIVE: NarrativeState = {
  summary: "", achievements: "", strengths: "", improvementAreas: "", trainingNeeds: "", nextPeriodGoals: "",
}

const NARRATIVE_KEYS = NARRATIVE_FIELDS.map((field) => field.key)
const isNarrativeKey = (key: string): key is NarrativeKey => (NARRATIVE_KEYS as string[]).includes(key)

/** Which narrative fields the built-in fallback puts on which tab. */
const STORY_KEYS: NarrativeKey[] = ["summary", "achievements", "strengths"]
const AHEAD_KEYS: NarrativeKey[] = ["improvementAreas", "trainingNeeds", "nextPeriodGoals"]

function fallbackSection(keys: NarrativeKey[], id: string, title: string): TemplateWizardSection {
  return {
    key: id,
    kind: "long_text",
    title,
    fields: NARRATIVE_FIELDS.filter((field) => keys.includes(field.key)).map((field) => ({
      key: field.key,
      label: field.label,
      description: field.placeholder,
    })),
  }
}

/**
 * The template's free-text sections, split across the two narrative tabs.
 *
 * The rules, in order:
 *   1. an imported template's sections come from ITS workbook;
 *   2. the first goes on "Your year in your words" and the rest on
 *      "Looking ahead", so a workbook defining one development block still
 *      fills both tabs rather than leaving one empty;
 *   3. a template with no structure at all falls back to the six built-in
 *      narrative fields, which is every template built by hand.
 *
 * A hardcoded field the template does not define is simply not in the list, so
 * it is never rendered — which is the "hide it" half of the rule.
 */
function narrativeSections(template: AppraisalDetail["template"], forReviewer: boolean) {
  const defined = (template.structure?.wizardSections ?? []).filter(
    (section) => section.kind === "long_text" && section.fields.length > 0
  )
  const own = defined.filter((section) => forReviewer || section.audience !== "reviewer")

  if (own.length === 0) {
    return {
      story: fallbackSection(STORY_KEYS, "story", "Your Year in Your Words"),
      ahead: fallbackSection(AHEAD_KEYS, "ahead", "Looking Ahead"),
    }
  }

  return {
    story: own[0],
    ahead: own.length > 1
      ? { ...own[1], key: own[1].key, fields: own.slice(1).flatMap((section) => section.fields) }
      : null,
  }
}

/**
 * The whole appraisal, as one full-page tabbed workspace.
 *
 * Replaces a single very long scroll (and, before that, a five-step wizard
 * that only the employee got) with tabs that both the employee and every
 * reviewer share. The answer state lives here rather than inside a tab, so
 * moving between tabs never loses what has been typed.
 *
 * Nothing about the workflow, scoring, permissions or versioning moved: what
 * a viewer may see is still decided by the server's `viewer` block, and this
 * only decides where it is shown.
 */
interface Step {
  key: string
  title: string
  caption: string
  section: TemplateWizardSection | null
}

/** One panel in the tab strip. */
interface DetailTab {
  id: string
  label: string
  icon: LucideIcon
  render: () => React.ReactNode
}

/**
 * The whole appraisal page: a compact header, the form taken one step at a
 * time, and the surrounding panels as a tab strip beneath it.
 *
 * The form is a STEPPER rather than tabs. Filling one in is a task with an
 * order and an end — tabs presented seven equal doors and no sense of how far
 * through you were, which is the opposite of what a long form needs. The
 * panels around it (history, comments, workflow) genuinely are equal doors, so
 * those stay tabs.
 *
 * Employee and reviewer share it. The answer state lives here, so moving
 * between steps never loses what has been typed.
 *
 * Nothing about the workflow, scoring, permissions or versioning moved: what a
 * viewer may see is still decided by the server's `viewer` block.
 */
export function AppraisalWorkspace({ appraisal }: { appraisal: AppraisalDetail }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { viewer } = appraisal

  const isEditor = viewer.canSubmitSelf || viewer.canSubmitReview
  const forReviewer = viewer.canSubmitReview
  const subjectOnlyView = viewer.isSubject && !viewer.isAdministrator

  const categories = appraisal.template.categories
  const draft = appraisal.selfAppraisalDraft
  const sections = useMemo(
    () => narrativeSections(appraisal.template, forReviewer),
    [appraisal.template, forReviewer]
  )

  const submitSelf = useSubmitSelfAppraisal(appraisal.id)
  const submitReview = useSubmitReview(appraisal.id)
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
  const [responses, setResponses] = useState<Record<string, string>>(() => ({ ...draft?.responses }))
  const [savedAt, setSavedAt] = useState<string | null>(draft?.savedAt ?? null)
  const [step, setStep] = useState(() => Math.max(0, (draft?.step ?? 1) - 1))

  // A reviewer writes against the employee's own V1; the employee writes
  // against nothing, because there is nothing they may compare with yet.
  const referenceRevision = appraisal.revisions.find((revision) => revision.stage === "self_appraisal")
  const referenceAnswers = useMemo(() => {
    if (!forReviewer) return undefined
    const map: Record<string, { rating: number | null; comment: string | null }> = {}
    referenceRevision?.answers.forEach((answer) => {
      map[String(answer.appraisalTemplateQuestionId)] = { rating: answer.rating, comment: answer.comment }
    })
    return map
  }, [forReviewer, referenceRevision])

  function setAnswer(questionId: string, patch: Partial<AnswerValue>) {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...EMPTY_ANSWER, ...prev[questionId], ...patch } }))
  }

  // The six fixed narrative keys keep their own columns; anything else is a
  // workbook-defined field and goes to `responses`. See SubmitRevision.
  const valueOf = (key: string) => (isNarrativeKey(key) ? narrative[key] : (responses[key] ?? ""))
  function setFieldValue(key: string, next: string) {
    if (isNarrativeKey(key)) setNarrative((prev) => ({ ...prev, [key]: next }))
    else setResponses((prev) => ({ ...prev, [key]: next }))
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

  /**
   * What is still outstanding, BY NAME.
   *
   * A bare "1 question still unrated" is indistinguishable from a bug when the
   * form looks complete — and it easily does, because an area collapses once
   * you move off it and a category can hold more than one question, so the
   * missing one is usually off-screen. Naming it is the difference between a
   * dead end and a one-click fix.
   */
  const outstanding = useMemo(
    () =>
      categories.flatMap((category) =>
        category.questions.flatMap((question) => {
          const answer = answers[question.id]
          const where = question.prompt === category.name ? category.name : `${category.name} — ${question.prompt}`
          if ((answer?.rating ?? null) == null) return [{ id: question.id, where, reason: "not rated" }]
          if (needsEvidence(answer)) return [{ id: question.id, where, reason: "needs evidence" }]
          return []
        })
      ),
    [categories, answers]
  )

  const unrated = outstanding.filter((item) => item.reason === "not rated").length
  const missingEvidence = outstanding.filter((item) => item.reason === "needs evidence").length

  /** Each area's standing, and how far through the form that puts you. */
  const areaProgress = useMemo(
    () =>
      categories.map((category) => {
        const ratings = category.questions
          .map((question) => answers[question.id]?.rating)
          .filter((rating): rating is number => rating != null)
        return {
          category,
          average: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
          complete: ratings.length === category.questions.length && category.questions.length > 0,
        }
      }),
    [categories, answers]
  )

  const completedAreas = areaProgress.filter((area) => area.complete).length
  const percentComplete = categories.length ? Math.round((completedAreas / categories.length) * 100) : 0

  /**
   * The score this is heading for, weighted and computed over the RATED areas
   * only — an unrated area is absent from the estimate rather than counted as
   * a zero, which would show a number that drops the moment you start.
   */
  const estimatedScore = useMemo(() => {
    const rated = areaProgress.filter((area) => area.average != null)
    const weight = rated.reduce((sum, area) => sum + Number(area.category.weight), 0)
    if (!weight) return null
    return rated.reduce((sum, area) => sum + area.average! * Number(area.category.weight), 0) / weight
  }, [areaProgress])

  const lensRollup = useMemo(
    () =>
      APPRAISAL_LENSES.map((lens) => {
        const inLens = categories.filter((category) => category.lens === (lens.value as AppraisalLens))
        const rated = inLens
          .flatMap((category) => category.questions)
          .map((question) => answers[question.id]?.rating)
          .filter((rating): rating is number => rating != null)
        return {
          ...lens,
          categories: inLens,
          weight: inLens.reduce((sum, category) => sum + Number(category.weight), 0),
          average: rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null,
        }
      }).filter((lens) => lens.categories.length > 0),
    [categories, answers]
  )

  // --- the steps -----------------------------------------------------------

  /**
   * The perspectives are a MANAGEMENT view of the appraisal: the reviewer
   * rates each one and records the evidence, and the weights describe how the
   * outcome is composed. None of it is the employee's to fill in, and showing
   * it during self-appraisal invited the reading that the weights were marks
   * they had already been given. So the whole step is theirs, not the
   * subject's.
   */
  const showsPerspectives = viewer.canSubmitReview || viewer.isAdministrator

  const steps: Step[] = [
    { key: "areas", title: "Performance areas", caption: "Rate and add your feedback", section: null },
    ...(showsPerspectives
      ? [{ key: "perspectives", title: "Perspective", caption: "Rate each perspective", section: null }]
      : []),
    ...(sections.story
      ? [{ key: "story", title: sections.story.title, caption: "Overall comments", section: sections.story }]
      : []),
    ...(sections.ahead
      ? [{ key: "ahead", title: sections.ahead.title, caption: "Future focus", section: sections.ahead }]
      : []),
    { key: "review", title: "Review & submit", caption: "Check and submit", section: null },
  ]

  // Clamped rather than trusted: a saved draft's step was recorded against the
  // template as it was, and a re-import can leave fewer steps.
  const stepIndex = Math.min(step, steps.length - 1)
  const current = steps[stepIndex]
  const isLast = stepIndex === steps.length - 1

  function persist(nextStep = stepIndex) {
    saveDraft.mutate(
      { step: nextStep + 1, answers: answerPayload, responses, ...narrative },
      { onSuccess: () => setSavedAt(new Date().toISOString()) }
    )
  }

  function goTo(next: number) {
    const target = Math.max(0, Math.min(steps.length - 1, next))
    // Saving on every move is what makes stepping backwards to edit safe:
    // nothing is lost by leaving a step, whichever direction you leave it in.
    persist(target)
    setStep(target)
  }

  function submit() {
    const payload = { answers: answerPayload, responses, ...narrative }
    if (viewer.canSubmitReview) submitReview.mutate(payload)
    else submitSelf.mutate(payload)
  }

  const isPending = submitSelf.isPending || submitReview.isPending
  const canSubmit = unrated === 0 && missingEvidence === 0

  // --- the panels beneath ---------------------------------------------------

  // The form itself. A function so it can be a TAB's body rather than a
  // slab above the tab strip — two stacked panels read as two windows.
  const renderForm = () => (
      <div className="grid gap-4">
        {/* Numbered stepper. Each step carries a caption as well as a name,
            and a fixed row height keeps every circle and connector on one
            line however long the labels run. */}
        <ol className="flex flex-wrap items-stretch gap-x-2 gap-y-3">
          {steps.map((definition, index) => {
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
                      className={cn("text-xs font-semibold", active ? "text-role-hr" : "text-foreground")}
                    >
                      {definition.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{definition.caption}</span>
                  </span>
                </button>
                {index < steps.length - 1 && (
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
        <p className="sr-only">
          Step {stepIndex + 1} of {steps.length} · {current.title}
        </p>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)]">
          <div className="grid min-w-0 gap-4">
            {current.key === "areas" && (
              <PerformanceAreaList
                categories={categories}
                answers={answers}
                onChange={setAnswer}
                reference={referenceAnswers}
                referenceLabel={
                  referenceRevision
                    ? `${referenceRevision.label} · ${referenceRevision.authorName}`
                    : undefined
                }
                // The workbook route sits on the heading row rather than in a
                // panel of its own above it — it is another way to fill THIS
                // section in, not a thing in its own right.
                action={
                  viewer.canSubmitSelf ? (
                    <SelfAppraisalImport appraisalId={appraisal.id} onConfirm={applyImported} compact />
                  ) : undefined
                }
              />
            )}

            {current.key === "perspectives" && (
              <PerspectivesPanel
                rollup={lensRollup}
                templatePerspectives={appraisal.template.structure?.perspectives}
                // Only a reviewer at their own stage assesses the perspectives;
                // the server has already withheld the fields from anyone else,
                // so this decides the inputs, not access.
                canAssess={viewer.canSubmitReview}
                valueOf={valueOf}
                onChange={setFieldValue}
              />
            )}

            {current.section && (
              <FieldSection section={current.section} valueOf={valueOf} onChange={setFieldValue} />
            )}

            {current.key === "review" && (
              <FinalReviewPanel
                appraisal={appraisal}
                categories={categories}
                answers={answers}
                sections={[sections.story, sections.ahead].filter(Boolean) as TemplateWizardSection[]}
                valueOf={valueOf}
                weightedScore={estimatedScore}
                outstanding={outstanding}
                lensRollup={lensRollup}
                onGoToStep={(key: string) => goTo(steps.findIndex((entry) => entry.key === key))}
              />
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <Button
                variant="outline"
                className="gap-1.5"
                disabled={stepIndex === 0}
                onClick={() => goTo(stepIndex - 1)}
              >
                <ArrowLeftIcon className="size-4" /> Back
              </Button>
              <Button variant="ghost" disabled={saveDraft.isPending} onClick={() => persist()}>
                Save draft
              </Button>
            </div>
          </div>

          {/* The standing summary. Everything in it is derived from what has
              been entered — there is nothing to fill in here. */}
          <aside className="grid gap-3 lg:sticky lg:top-4">
            <section className="grid gap-3 rounded-xl border p-4">
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

            <section className="grid gap-2 rounded-xl border p-4">
              <h3 className="text-sm font-semibold">Selected ratings</h3>
              <ul className="grid gap-1.5">
                {areaProgress.map(({ category, average }) => (
                  <li key={category.id} className="flex items-center gap-2 text-xs">
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
                ))}
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

            {/* Shown once for the whole form, always in view while rating. */}
            <RatingGuide guide={appraisal.template.structure?.ratingGuide} />
          </aside>
        </div>
      </div>
  )

  const tabs: DetailTab[] = [
    // The form first: it is what the person came to do. Everything after it is
    // the record around it, in the order it accumulates — what was written,
    // what was said, then the process, then the money.
    ...(isEditor
      ? [{
          id: "form",
          label: viewer.canSubmitReview ? "Your review" : "Self-appraisal",
          icon: PencilLineIcon,
          render: renderForm,
        }]
      : []),
    { id: "history", label: "Version history", icon: HistoryIcon,
      render: () => <RevisionHistory appraisal={appraisal} /> },
    { id: "comments", label: "Comments", icon: MessageSquareIcon,
      render: () => <AppraisalComments appraisal={appraisal} /> },
    // §21 — optional, and never a gate on the workflow.
    { id: "feedback", label: "Additional feedback", icon: UsersRoundIcon,
      render: () => <FeedbackRequestsPanel appraisal={appraisal} /> },
  ]

  // The management apparatus, withheld from the subject.
  if (!subjectOnlyView) {
    tabs.push(
      { id: "workflow", label: "Workflow", icon: GaugeIcon,
        render: () => (
          <AppraisalWorkflowTimeline
            status={appraisal.status}
            secondaryApplicable={appraisal.secondaryReviewApplicable}
            transitions={appraisal.transitions}
          />
        ) },
      { id: "reviewers", label: "Reviewers", icon: NetworkIcon,
        render: () => <ManagerChain appraisal={appraisal} /> }
    )
  }

  tabs.push({
    id: "deadlines", label: "Deadlines", icon: CalendarDaysIcon,
    render: () => (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Deadline label="Self-appraisal" date={appraisal.cycle.employeeSubmissionDeadline} />
        <Deadline label="Primary review" date={appraisal.cycle.primaryReviewDeadline} />
        {appraisal.secondaryReviewApplicable && (
          <Deadline label="Secondary review" date={appraisal.cycle.secondaryReviewDeadline} />
        )}
        <Deadline label="Finalization" date={appraisal.cycle.finalizationDeadline} />
      </div>
    ),
  })

  if (!subjectOnlyView && appraisal.scoreOverrides.length > 0) {
    tabs.push({
      id: "calibration", label: "Calibration", icon: GaugeIcon,
      render: () => (
        <ul className="grid gap-2">
          {appraisal.scoreOverrides.map((override) => (
            <li key={override.id} className="grid gap-0.5 rounded-lg border p-2.5">
              <p className="text-sm font-medium tabular-nums">
                {override.previousScore ? Number(override.previousScore).toFixed(2) : "—"} →{" "}
                {Number(override.newScore).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                {override.actorName} · {new Date(override.createdAt).toLocaleDateString()}
              </p>
              <p className="text-xs">{override.reason}</p>
            </li>
          ))}
        </ul>
      ),
    })
  }

  // Restricted: the server omits the compensation block entirely unless the
  // viewer holds appraisals.manage_compensation.
  if (viewer.canManageCompensation) {
    tabs.push({
      id: "compensation", label: "Compensation & promotion", icon: ShieldIcon,
      render: () => <CompensationPanel appraisal={appraisal} />,
    })
  }

  const requestedTab = searchParams.get("tab")
  const activeTab = tabs.find((tab) => tab.id === requestedTab) ?? tabs[0]

  function selectTab(id: string) {
    const params = new URLSearchParams(Array.from(searchParams.entries()))
    params.set("tab", id)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  const primaryAction = isLast ? (
    <Button
      className="w-full gap-1.5 bg-role-hr text-role-hr-foreground shadow-2xs hover:bg-role-hr/90"
      disabled={isPending || !canSubmit}
      onClick={submit}
    >
      {isPending ? "Submitting…" : viewer.canSubmitReview ? "Submit review" : "Submit self-appraisal"}
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
    <div className="grid gap-4">
      <AppraisalHeader
        appraisal={appraisal}
        saving={saveDraft.isPending}
        savedAt={savedAt}
        showSaveState={isEditor}
      />

      {/* One tab bar for the whole page. The form is the first tab rather
          than a slab above the strip — stacked, the two read as two separate
          windows on one screen. */}
      <nav
        aria-label="Appraisal sections"
        className="-mx-1 flex gap-1 overflow-x-auto border-b px-1 pb-px"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.id === activeTab.id
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => selectTab(tab.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
                isActive
                  ? "border-role-hr font-semibold text-role-hr"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          )
        })}
      </nav>

      <section className="rounded-xl border bg-card p-4 shadow-2xs sm:p-5">{activeTab.render()}</section>
    </div>
  )
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

/** One labelled date in the Deadlines panel. */
function Deadline({ label, date }: { label: string; date: string | null }) {
  return (
    <div className="grid gap-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">
        {date ? new Date(date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"}
      </p>
    </div>
  )
}


function AppraisalHeader({
  appraisal,
  saving,
  savedAt,
  showSaveState,
}: {
  appraisal: AppraisalDetail
  saving: boolean
  savedAt: string | null
  showSaveState: boolean
}) {
  const employee = appraisal.employee
  const initials = (appraisal.employeeName ?? "")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-card p-4 shadow-2xs">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-role-hr/12 text-base font-semibold text-role-hr">
          {initials}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">{appraisal.employeeName}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {[employee?.designationTitle, employee?.departmentName].filter(Boolean).join(" · ") ||
              appraisal.template.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {appraisal.employeeCode && <span>{appraisal.employeeCode}</span>}
            {appraisal.primaryManagerName && <span>Reporting to {appraisal.primaryManagerName}</span>}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
        <AppraisalStatusBadge status={appraisal.status} />
        <p className="text-sm font-medium">{appraisal.cycleName}</p>
        {(appraisal.cycle.assessmentPeriodStart || appraisal.cycle.assessmentPeriodEnd) && (
          <p className="text-xs text-muted-foreground">
            {formatDate(appraisal.cycle.assessmentPeriodStart)} – {formatDate(appraisal.cycle.assessmentPeriodEnd)}
          </p>
        )}
        {showSaveState && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {saving ? (
              <>
                <CloudIcon className="size-3.5 animate-pulse" /> Saving…
              </>
            ) : savedAt ? (
              <>
                <CheckIcon className="size-3.5 text-success" /> Saved{" "}
                {new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </>
            ) : (
              <>
                <CloudIcon className="size-3.5" /> Nothing saved yet
              </>
            )}
          </p>
        )}
      </div>
    </div>
  )
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"
}

/** The three lenses, and the template's own perspective definitions. */
const MANAGER_RATING_SUFFIX = "__manager_rating"
const MANAGER_SUMMARY_SUFFIX = "__manager_summary"

/**
 * The three perspectives the template weights the appraisal on.
 *
 * The 60 / 25 / 15 are TEMPLATE WEIGHTS, not anybody's rating — that
 * distinction is spelled out because a big number beside a perspective reads
 * like a score, and an employee seeing "60%" next to "Past Performance" could
 * reasonably think they had been marked.
 *
 * The manager's rating and evidence per perspective are the REVIEWER's, filled
 * in per employee at review time. An employee never sees them: the server
 * strips them from the template payload (DetailPresenter#template_payload), so
 * this is presentation of an absence rather than the guard itself.
 */
function PerspectivesPanel({
  rollup,
  templatePerspectives,
  canAssess,
  valueOf,
  onChange,
}: {
  rollup: { value: string; label: string; weight: number; targetWeight: number; average: number | null }[]
  templatePerspectives: NonNullable<AppraisalDetail["template"]["structure"]>["perspectives"]
  canAssess: boolean
  valueOf: (key: string) => string
  onChange: (key: string, next: string) => void
}) {
  const defined = templatePerspectives ?? []
  const keyFor = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Performance perspectives</h2>
        <p className="text-sm text-muted-foreground">
          {canAssess
            ? "Rate this employee against each perspective and record the evidence behind it."
            : "How this appraisal is weighted, and how your own area ratings roll up across it."}
        </p>
      </div>

      {defined.length > 0 && (
        <ul className="grid gap-3">
          {defined.map((perspective) => {
            const base = keyFor(perspective.name)
            return (
              <li key={perspective.name} className="grid gap-2 rounded-xl border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{perspective.name}</p>
                  {perspective.weight != null && (
                    <Badge variant="outline" className="shrink-0 tabular-nums">
                      {/* Labelled, so it cannot be mistaken for a score. */}
                      {perspective.weight}% of the total
                    </Badge>
                  )}
                </div>
                {perspective.assessmentFocus && (
                  <p className="text-xs text-muted-foreground">{perspective.assessmentFocus}</p>
                )}

                {canAssess && (
                  <div className="mt-1 grid gap-3 border-t pt-3 sm:grid-cols-[13rem_minmax(0,1fr)]">
                    <div className="grid gap-1">
                      <p className="text-xs font-semibold">Manager rating</p>
                      <RatingSelect
                        value={Number(valueOf(base + MANAGER_RATING_SUFFIX)) || null}
                        onChange={(rating) => onChange(base + MANAGER_RATING_SUFFIX, String(rating))}
                      />
                    </div>
                    <div className="grid gap-1">
                      <label
                        htmlFor={`perspective-${base}`}
                        className="text-xs font-semibold"
                      >
                        Manager summary / evidence
                      </label>
                      <textarea
                        id={`perspective-${base}`}
                        rows={3}
                        value={valueOf(base + MANAGER_SUMMARY_SUFFIX)}
                        onChange={(event) => onChange(base + MANAGER_SUMMARY_SUFFIX, event.target.value)}
                        placeholder="What supports this rating?"
                        className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                      />
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="grid gap-2">
        <p className="text-xs font-semibold text-muted-foreground">
          {canAssess ? "The employee's own area ratings, rolled up" : "Your area ratings, rolled up"}
        </p>
        <ul className="grid gap-2">
          {rollup.map((lens) => (
            <li key={lens.value} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{lens.label}</p>
                <p className="text-xs text-muted-foreground">
                  {lens.weight}% of this appraisal
                  {lens.weight !== lens.targetWeight && ` (standard split is ${lens.targetWeight}%)`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg leading-tight font-semibold tabular-nums">
                  {lens.average != null ? lens.average.toFixed(1) : "—"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {lens.average != null ? "average so far" : "not rated yet"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** One template-defined free-text section. */
function FieldSection({
  section,
  valueOf,
  onChange,
  readOnly,
}: {
  section: TemplateWizardSection
  valueOf: (key: string) => string
  onChange: (key: string, next: string) => void
  readOnly?: boolean
}) {
  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">{section.title}</h2>
        {section.caption && <p className="text-sm text-muted-foreground">{section.caption}</p>}
      </div>
      {section.fields.map((field: TemplateField) => (
        <div key={field.key} className="grid gap-1.5">
          <label htmlFor={`field-${field.key}`} className="text-sm font-medium">
            {field.label}
          </label>
          {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
          <textarea
            id={`field-${field.key}`}
            rows={4}
            readOnly={readOnly}
            value={valueOf(field.key)}
            onChange={(event) => onChange(field.key, event.target.value)}
            className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>
      ))}
    </div>
  )
}

/** Everything entered, plus what is still outstanding. */
function FinalReviewPanel({
  appraisal,
  categories,
  answers,
  sections,
  valueOf,
  weightedScore,
  outstanding,
  lensRollup,
  onGoToStep,
}: {
  appraisal: AppraisalDetail
  categories: AppraisalDetail["template"]["categories"]
  answers: AnswerState
  sections: TemplateWizardSection[]
  valueOf: (key: string) => string
  weightedScore: number | null
  outstanding: { id: string; where: string; reason: string }[]
  lensRollup: { value: string; label: string; weight: number; average: number | null }[]
  onGoToStep: (key: string) => void
}) {
  const complete = outstanding.length === 0
  const totalQuestions = categories.reduce((sum, category) => sum + category.questions.length, 0)

  return (
    <div className="grid gap-4">
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3 text-sm",
          complete ? "border-success/40 bg-success/5 text-success" : "border-warning/40 bg-warning/5 text-warning"
        )}
      >
        {complete ? (
          <>
            <CheckIcon className="size-4" />
            <span>Everything is filled in. Read it through, then submit.</span>
          </>
        ) : (
          <>
            <TriangleAlertIcon className="size-4" />
            <span>
              {outstanding.length} item{outstanding.length === 1 ? "" : "s"} still to finish
            </span>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => onGoToStep("areas")}>
              Fix in Performance Areas
            </Button>
            {/* Named, not counted. Which one is missing is the whole question
                the reader has when they believe they filled everything in. */}
            <ul className="w-full grid gap-1 border-t border-current/20 pt-2">
              {outstanding.map((item) => (
                <li key={`${item.id}-${item.reason}`} className="text-xs">
                  {item.where} — {item.reason}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Stat label="Weighted score" value={weightedScore != null ? weightedScore.toFixed(2) : "—"} />
        <Stat
          label="Questions rated"
          value={`${totalQuestions - outstanding.filter((i) => i.reason === "not rated").length} of ${totalQuestions}`}
        />
        <Stat
          label="Evidence outstanding"
          value={String(outstanding.filter((i) => i.reason === "needs evidence").length)}
        />
      </div>

      <SummaryBlock title="Performance areas" onEdit={() => onGoToStep("areas")}>
        <ul className="grid gap-1.5">
          {categories.map((category) => {
            const ratings = category.questions
              .map((question) => answers[question.id]?.rating)
              .filter((rating): rating is number => rating != null)
            const average = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
            return (
              <li key={category.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm">
                <span className="min-w-0 truncate">{category.name}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="tabular-nums">
                    {Number(category.weight)}%
                  </Badge>
                  <span className={cn("tabular-nums", average == null && "text-warning")}>
                    {average != null ? `${average} / 5` : "Not rated"}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </SummaryBlock>

      {lensRollup.length > 0 && (
      <SummaryBlock title="Performance perspectives" onEdit={() => onGoToStep("perspectives")}>
        <ul className="grid gap-1.5 sm:grid-cols-3">
          {lensRollup.map((lens) => (
            <li key={lens.value} className="grid gap-0.5 rounded-lg border p-2.5">
              <p className="text-xs text-muted-foreground">{lens.label}</p>
              <p className="text-lg leading-tight font-semibold tabular-nums">
                {lens.average != null ? lens.average.toFixed(1) : "—"}
              </p>
            </li>
          ))}
        </ul>
      </SummaryBlock>
      )}

      {sections.map((section) => (
        <SummaryBlock
          key={section.key}
          title={section.title}
          onEdit={() => onGoToStep(section.key === sections[0]?.key ? "story" : "ahead")}
        >
          <div className="grid gap-2">
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
        </SummaryBlock>
      ))}

      <p className="text-xs text-muted-foreground">
        Submitting creates the next version and sends it on to{" "}
        {appraisal.managers.primary?.fullName ?? "your primary manager"}. After that it is locked, and any change
        has to come back as a correction.
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 rounded-xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl leading-tight font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function SummaryBlock({
  title,
  onEdit,
  children,
}: {
  title: string
  onEdit: () => void
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button variant="outline" size="sm" onClick={onEdit}>
          Edit
        </Button>
      </div>
      {children}
    </section>
  )
}

/** The reporting line this appraisal was snapshotted against. */
function ManagerChain({ appraisal }: { appraisal: AppraisalDetail }) {
  const rows = [
    ["Primary manager", appraisal.managers.primary],
    ["Secondary manager", appraisal.managers.secondary],
    ["Final manager", appraisal.managers.final],
  ] as const

  return (
    <ul className="grid gap-2">
      {rows.map(([label, manager]) =>
        manager ? (
          <li key={label} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-sm font-medium">{manager.fullName}</span>
          </li>
        ) : null
      )}
    </ul>
  )
}

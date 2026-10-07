"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  CheckIcon,
  CloudIcon,
  DownloadIcon,
  FileTextIcon,
  GaugeIcon,
  HistoryIcon,
  MessageSquareIcon,
  NetworkIcon,
  PencilLineIcon,
  TargetIcon,
  TriangleAlertIcon,
  UploadIcon,
  UsersRoundIcon,
  MenuIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "cn"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { PanelBody, PanelHeader } from "@/components/ui/panel"
import { AppraisalStatusBadge } from "@/features/appraisals/components/appraisal-badges"
import { AppraisalWorkflowTimeline } from "@/features/appraisals/components/appraisal-workflow-timeline"
import { PerformanceAreaList } from "@/features/appraisals/components/performance-area-list"
import { DiscussionPanel } from "@/features/appraisals/components/discussion-panel"
import { LetterTab } from "@/features/appraisals/components/appraisal-letter"
import { appraisalsApi } from "@/features/appraisals/api"
import {
  RatingGuide,
  RatingScaleContext,
  RatingSelect,
  useRatingScale,
} from "@/features/appraisals/components/rating-select"
import { RevisionHistory } from "@/features/appraisals/components/revision-history"
import { AppraisalComments } from "@/features/appraisals/components/appraisal-comments"
import { FeedbackRequestsPanel } from "@/features/appraisals/components/feedback-requests-panel"
import {
  SelfAppraisalImport,
  type SelfAppraisalImportHandle,
} from "@/features/appraisals/components/self-appraisal-import"
import {
  EMPTY_ANSWER,
  needsEvidence,
  type AnswerValue,
} from "@/features/appraisals/components/question-answer"
import {
  NARRATIVE_FIELDS,
  ratingScaleFrom,
  templateFieldAudience,
  type NarrativeKey, formatRating } from "@/features/appraisals/constants"
import {
  useSaveReviewDraft,
  useSaveSelfAppraisalDraft,
  useSubmitSelfAppraisal,
  useSubmitReview,
} from "@/features/appraisals/hooks/use-appraisal-mutations"
import type {
  AppraisalDetail,
  ImportPreviewResponse,
  ImportPreviewRow,
  TemplateField,
  TemplateWizardSection,
} from "@/types/appraisals"

type AnswerState = Record<string, AnswerValue>
type NarrativeState = Record<NarrativeKey, string>

const EMPTY_NARRATIVE: NarrativeState = {
  summary: "",
  achievements: "",
  strengths: "",
  improvementAreas: "",
  trainingNeeds: "",
  nextPeriodGoals: "",
}

const NARRATIVE_KEYS = NARRATIVE_FIELDS.map((field) => field.key)
const isNarrativeKey = (key: string): key is NarrativeKey =>
  (NARRATIVE_KEYS as string[]).includes(key)

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
type FormRole = "employee" | "manager" | "admin"

/** From the Discussion step on, Admin/HR see the Discussion tab. */
const DISCUSSION_ONWARDS: AppraisalDetail["status"][] = [
  "appraisal_discussion",
  "released",
  "employee_acknowledged",
  "closed",
]

function narrativeSections(template: AppraisalDetail["template"], role: FormRole) {
  const defined = (template.structure?.wizardSections ?? []).filter(
    (section) => section.kind === "long_text" && section.fields.length > 0
  )
  // Each field is asked of whoever answers it. The Final Review block is the
  // mixed one: the employee writes their final comments, every manager level
  // writes theirs and a promotion recommendation, and Admin/HR — who read all
  // of those at Discussion — are not asked them again in the Final review.
  const own = defined
    .filter((section) => !(role === "admin" && section.key === "final_review"))
    .map((section) => ({
      ...section,
      fields: section.fields.filter((field) => {
        const audience = templateFieldAudience(section.key, field, section.audience)
        if (audience === "both") return true
        return role === "employee" ? audience === "employee" : audience === "reviewer"
      }),
    }))
    .filter((section) => section.fields.length > 0)

  if (own.length === 0) {
    return {
      story: fallbackSection(STORY_KEYS, "story", "Your Year in Your Words"),
      ahead: fallbackSection(AHEAD_KEYS, "ahead", "Looking Ahead"),
    }
  }

  return {
    story: own[0],
    ahead:
      own.length > 1
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
  // The template's own rating guide drives every rating control on this page.
  const ratingGuide = appraisal.template.structure?.ratingGuide
  const ratingScale = useMemo(() => ratingScaleFrom(ratingGuide), [ratingGuide])
  // Scores are shown out of the template's own top rating, not a fixed 5.
  const ratingMax = ratingScale.at(-1)?.value ?? 5
  const router = useRouter()
  const searchParams = useSearchParams()
  const { viewer } = appraisal

  const isEditor = viewer.canSubmitSelf || viewer.canSubmitReview
  const forReviewer = viewer.canSubmitReview
  const subjectOnlyView = viewer.isSubject && !viewer.isAdministrator

  const categories = appraisal.template.categories
  // A reviewer resumes their own review draft; the employee their self draft.
  const draft = forReviewer ? appraisal.reviewDraft : appraisal.selfAppraisalDraft
  const formRole: FormRole = !forReviewer ? "employee" : appraisal.status === "final_review" ? "admin" : "manager"
  const sections = useMemo(
    () => narrativeSections(appraisal.template, formRole),
    [appraisal.template, formRole]
  )

  const submitSelf = useSubmitSelfAppraisal(appraisal.id)
  const submitReview = useSubmitReview(appraisal.id)
  const saveSelfDraft = useSaveSelfAppraisalDraft(appraisal.id)
  const saveReviewDraft = useSaveReviewDraft(appraisal.id)
  // Each saves to its own place: a manager stepping through the form used to
  // hit the employee's draft endpoint and get "you don't have permission" on
  // every step. Anyone else (e.g. an admin just reading) saves nothing.
  const saveDraft = viewer.canSaveReviewDraft
    ? saveReviewDraft
    : viewer.canSaveSelfDraft
      ? saveSelfDraft
      : null

  // Seeded ONCE from the saved draft. Re-seeding on every fetch would fight
  // the person typing, since each save refetches the appraisal.
  const [answers, setAnswers] = useState<AnswerState>(() => {
    const seeded: AnswerState = {}
    draft?.answers?.forEach((answer) => {
      // Guarded, because `String(undefined)` is the perfectly valid map key
      // "undefined" — which then travelled all the way to the server as a
      // question id and came back as "Question undefined does not belong to
      // this appraisal's template". An answer with no question isn't an
      // answer; it is dropped here rather than poisoning the payload.
      if (answer.questionId == null) return
      seeded[String(answer.questionId)] = { rating: answer.rating, comment: answer.comment ?? "" }
    })
    return seeded
  })
  const [narrative, setNarrative] = useState<NarrativeState>(() => ({
    ...EMPTY_NARRATIVE,
    ...draft?.narrative,
  }))
  const [responses, setResponses] = useState<Record<string, string>>(() => ({
    ...draft?.responses,
  }))
  const [savedAt, setSavedAt] = useState<string | null>(draft?.savedAt ?? null)
  const [step, setStep] = useState(() => Math.max(0, (draft?.step ?? 1) - 1))

  // A reviewer writes against the employee's own V1; the employee writes
  // against nothing, because there is nothing they may compare with yet.
  const referenceRevision = appraisal.revisions.find(
    (revision) => revision.stage === "self_appraisal"
  )
  const referenceAnswers = useMemo(() => {
    if (!forReviewer) return undefined
    const map: Record<string, { rating: number | null; comment: string | null }> = {}
    referenceRevision?.answers.forEach((answer) => {
      map[String(answer.appraisalTemplateQuestionId)] = {
        rating: answer.rating,
        comment: answer.comment,
      }
    })
    return map
  }, [forReviewer, referenceRevision])

  function setAnswer(questionId: string, patch: Partial<AnswerValue>) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...EMPTY_ANSWER, ...prev[questionId], ...patch },
    }))
  }

  // The six fixed narrative keys keep their own columns; anything else is a
  // workbook-defined field and goes to `responses`. See SubmitRevision.
  const valueOf = (key: string) => (isNarrativeKey(key) ? narrative[key] : (responses[key] ?? ""))
  function setFieldValue(key: string, next: string) {
    if (isNarrativeKey(key)) setNarrative((prev) => ({ ...prev, [key]: next }))
    else setResponses((prev) => ({ ...prev, [key]: next }))
  }

  /**
   * Fill the form in from an uploaded workbook.
   *
   * Both halves land, not just the ratings: a filled company workbook carries
   * the development and final-review prose too, and importing only the numbers
   * would leave the employee retyping the part that took them longest.
   *
   * Still nothing is submitted — this only populates the form, which the
   * person then reviews and submits through the ordinary path.
   */
  function applyImported(rows: ImportPreviewRow[], imported: ImportPreviewResponse[] = []) {
    setAnswers((prev) => {
      const next = { ...prev }
      rows.forEach((row) => {
        if (row.questionId == null) return
        next[String(row.questionId)] = { rating: row.rating, comment: row.comment ?? "" }
      })
      return next
    })
    imported.forEach(({ key, value }) => setFieldValue(key, value))
  }

  const answerPayload = useMemo(
    () =>
      Object.entries(answers)
        // `String(undefined)` is a perfectly valid object key, so a missing
        // question id used to become the literal key "undefined" and travel to
        // the server as one. Guarded at the source too; this is the last
        // gate before the request, and it checks for the sentinel rather than
        // for a shape, since a question id is opaque here.
        .filter(([questionId]) => questionId && questionId !== "undefined" && questionId !== "null")
        .filter(([, answer]) => answer.rating != null || answer.comment.trim())
        .map(([questionId, answer]) => ({
          questionId,
          rating: answer.rating,
          comment: answer.comment,
        })),
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
          const where =
            question.prompt === category.name
              ? category.name
              : `${category.name} — ${question.prompt}`
          if ((answer?.rating ?? null) == null)
            return [{ id: question.id, where, reason: "not rated" }]
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
  const percentComplete = categories.length
    ? Math.round((completedAreas / categories.length) * 100)
    : 0

  /**
   * The score this is heading for, weighted and computed over the RATED areas
   * only — an unrated area is absent from the estimate rather than counted as
   * a zero, which would show a number that drops the moment you start.
   */
  const estimatedScore = useMemo(() => {
    const rated = areaProgress.filter((area) => area.average != null)
    const weight = rated.reduce((sum, area) => sum + Number(area.category.weight), 0)
    if (!weight) return null
    return (
      rated.reduce((sum, area) => sum + area.average! * Number(area.category.weight), 0) / weight
    )
  }, [areaProgress])

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
    {
      key: "areas",
      title: "Performance areas",
      caption: "Rate and add your feedback",
      section: null,
    },
    ...(showsPerspectives
      ? [
          {
            key: "perspectives",
            title: "Perspective",
            caption: "Rate each perspective",
            section: null,
          },
        ]
      : []),
    ...(sections.story
      ? [
          {
            key: "story",
            title: sections.story.title,
            caption: "Overall comments",
            section: sections.story,
          },
        ]
      : []),
    ...(sections.ahead
      ? [
          {
            key: "ahead",
            title: sections.ahead.title,
            caption: "Future focus",
            section: sections.ahead,
          },
        ]
      : []),
    { key: "review", title: "Review & submit", caption: "Check and submit", section: null },
  ]

  // Clamped rather than trusted: a saved draft's step was recorded against the
  // template as it was, and a re-import can leave fewer steps.
  const stepIndex = Math.min(step, steps.length - 1)
  const current = steps[stepIndex]
  const isLast = stepIndex === steps.length - 1

  function persist(nextStep = stepIndex) {
    if (!saveDraft) return
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

  // The Tools menu's side panel, and the workbook importer it drives.
  const [toolPanel, setToolPanel] = useState<"progress" | "guide" | null>(null)
  const importRef = useRef<SelfAppraisalImportHandle>(null)
  const isPending = submitSelf.isPending || submitReview.isPending
  // The server refuses a self-appraisal while Aadhaar or PAN is missing from the
  // employee's profile; say so here instead of letting Submit fail.
  const missingDocuments = viewer.canSubmitSelf ? (viewer.missingIdentityDocuments ?? []) : []
  const canSubmit = unrated === 0 && missingEvidence === 0 && missingDocuments.length === 0

  // --- the panels beneath ---------------------------------------------------

  // The form itself. A function so it can be a TAB's body rather than a
  // slab above the tab strip — two stacked panels read as two windows.
  const renderForm = () => (
    <div className="grid gap-4">
      {/* Numbered stepper.
            
            The circles sit on ONE line with the connectors running between
            them, and each step's name and caption hang underneath. Side-by-side
            labels pushed every circle apart by however long its words were, so
            the connectors were long, the row was tall, and the whole strip ate
            the top of the page before any of the form appeared. Stacking the
            text under the circle costs one short line and gives it all back. */}
      <ol className="flex items-start gap-1">
        {steps.map((definition, index) => {
          const done = index < stepIndex
          const active = index === stepIndex
          return (
            <li key={definition.key} className="flex min-w-0 flex-1 items-start gap-1">
              <button
                type="button"
                // Backwards only: a step you haven't reached can't be
                // meaningfully reviewed yet, and Continue is the way forward.
                disabled={index > stepIndex}
                aria-current={active ? "step" : undefined}
                onClick={() => goTo(index)}
                className={cn(
                  "grid min-w-0 flex-1 justify-items-center gap-1 rounded-lg px-1 py-1 text-center transition-colors",
                  index > stepIndex ? "cursor-not-allowed opacity-55" : "hover:bg-muted/60"
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums transition-colors",
                    active
                      ? "border-role-hr bg-role-hr text-role-hr-foreground ring-4 ring-role-hr/15"
                      : done
                        ? "border-success bg-success text-success-foreground"
                        : "border-muted-foreground/30 bg-card text-muted-foreground"
                  )}
                >
                  {done ? <CheckIcon className="size-3" /> : index + 1}
                </span>
                <span className="grid min-w-0 leading-tight">
                  <span
                    className={cn(
                      "truncate text-[11px] font-semibold",
                      active ? "text-role-hr" : "text-foreground"
                    )}
                  >
                    {definition.title}
                  </span>
                  {/* The caption is the first thing to go on a narrow
                        screen — the step's name carries the meaning. */}
                  <span className="hidden truncate text-[10px] text-muted-foreground sm:block">
                    {definition.caption}
                  </span>
                </span>
              </button>
              {index < steps.length - 1 && (
                <span
                  aria-hidden
                  // Aligned with the middle of the circles, which sit at the
                  // top of each column now that the text is below them.
                  className={cn(
                    "mt-[11px] hidden h-px min-w-2 flex-1 sm:block",
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

      <div className="grid items-start gap-4">
        <div className="grid min-w-0 gap-4">
          {/* At the top, so it's read before the form is filled in rather
              than discovered at the Submit button. */}
          {missingDocuments.length > 0 && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" />
              <p>
                Upload your {missingDocuments.join(" and ")} on your profile before you can submit your
                self-appraisal.{" "}
                <Link href="/profile?tab=documents" className="font-medium underline underline-offset-2">
                  Go to Documents
                </Link>
              </p>
            </div>
          )}

          {current.key !== "areas" && <div className="flex justify-end">{toolsMenu}</div>}

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
                <>
                  {viewer.canSubmitSelf && (
                    <SelfAppraisalImport
                      appraisalId={appraisal.id}
                      onConfirm={applyImported}
                      compact
                      hideButtons
                      controlRef={importRef}
                    />
                  )}
                  {toolsMenu}
                </>
              }
            />
          )}

          {current.key === "perspectives" && (
            <PerspectivesPanel
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
              // Withheld from the employee, who is never shown a score.
              weightedScore={subjectOnlyView ? undefined : estimatedScore}
              outstanding={outstanding}
              documentsMissing={missingDocuments.length > 0}
              onGoToStep={(key: string) => goTo(steps.findIndex((entry) => entry.key === key))}
            />
          )}

          <div className="grid gap-2 border-t pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="outline"
                className="gap-1.5"
                disabled={stepIndex === 0}
                onClick={() => goTo(stepIndex - 1)}
              >
                <ArrowLeftIcon className="size-4" /> Back
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" disabled={!saveDraft || saveDraft.isPending} onClick={() => persist()}>
                  Save
                </Button>
                {primaryAction}
              </div>
            </div>
            <p className="text-right text-[11px] text-muted-foreground">Your progress is saved automatically</p>
          </div>
        </div>

        {/* The Tools menu's side panel (progress & score, or the rating guide). */}

          <Sheet open={toolPanel !== null} onOpenChange={(open) => !open && setToolPanel(null)}>
            <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
              <PanelHeader
                icon={toolPanel === "guide" ? BookOpenIcon : TargetIcon}
                title={toolPanel === "guide" ? "Rating guide" : "Your progress"}
                description={
                  toolPanel === "guide"
                    ? "What each rating means."
                    : "Worked out from what has been filled in so far."
                }
              />
              <PanelBody>
                {toolPanel === "guide" ? (
                  <RatingGuide guide={appraisal.template.structure?.ratingGuide} />
                ) : (
                  <div className="grid gap-2.5">
                        <section className="grid gap-2 rounded-xl border p-3">
                          <h3 className="flex items-center gap-2 text-sm font-semibold">
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-role-hr/12 text-role-hr">
                              <TargetIcon className="size-3.5" />
                            </span>
                            Your progress
                          </h3>
                          <div className="flex items-center gap-3">
                            <div className="relative flex shrink-0 items-center justify-center">
                              <ProgressRing percent={percentComplete} />
                              <span className="absolute text-xs font-semibold tabular-nums">
                                {percentComplete}%
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-lg leading-tight font-semibold tabular-nums">
                                {completedAreas} of {categories.length}
                              </p>
                              <p className="text-xs text-muted-foreground">areas completed</p>
                            </div>
                          </div>
                        </section>

                        <section className="grid gap-2 rounded-xl border p-3">
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
                                    <span className="font-normal text-muted-foreground">/ {ratingMax}</span>
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>

                          {/* Scores are never shown to the employee — not even an estimate of their own. */}
                          {!subjectOnlyView && (
                            <div className="mt-1 grid gap-1.5 border-t pt-3">
                              <p className="text-xs font-medium text-muted-foreground">Estimated overall score</p>
                              <p className="text-2xl leading-none font-bold tabular-nums">
                                {estimatedScore == null ? "—" : estimatedScore.toFixed(1)}
                                <span className="text-base font-normal text-muted-foreground"> / {ratingMax}</span>
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                Based on completed ratings (weighted)
                              </p>
                              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-role-hr transition-[width] duration-500"
                                  style={{ width: `${estimatedScore == null ? 0 : (estimatedScore / ratingMax) * 100}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </section>
            
                  </div>
                )}
              </PanelBody>
            </SheetContent>
          </Sheet>
      </div>
    </div>
  )

  const tabs: DetailTab[] = [
    // Once released, the employee came for their letter: it leads.
    ...(subjectOnlyView && appraisal.letter?.available
      ? [
          {
            id: "letter",
            label: "Letter",
            icon: FileTextIcon,
            render: () => <LetterTab appraisal={appraisal} />,
          },
        ]
      : []),
    // The form first: it is what the person came to do. Everything after it is
    // the record around it, in the order it accumulates — what was written,
    // what was said, then the process, then the money.
    ...(isEditor
      ? [
          {
            id: "form",
            label: viewer.canSubmitReview ? "Your review" : "Self-appraisal",
            icon: PencilLineIcon,
            render: renderForm,
          },
        ]
      : []),
    // Admin/HR's Discussion: first in line once the reviews are done, and kept
    // afterwards as the record of what was decided. Never the employee's.
    ...(appraisal.discussion && DISCUSSION_ONWARDS.includes(appraisal.status)
      ? [
          {
            id: "discussion",
            label: "Discussion",
            icon: MessageSquareIcon,
            render: () => <DiscussionPanel appraisal={appraisal} />,
          },
        ]
      : []),
    {
      id: "history",
      label: "Version history",
      icon: HistoryIcon,
      render: () => <RevisionHistory appraisal={appraisal} />,
    },
    {
      id: "comments",
      label: "Comments",
      icon: MessageSquareIcon,
      render: () => <AppraisalComments appraisal={appraisal} />,
    },
    // §21 — optional, and never a gate on the workflow.
    {
      id: "feedback",
      label: "Additional feedback",
      icon: UsersRoundIcon,
      render: () => <FeedbackRequestsPanel appraisal={appraisal} />,
    },
  ]

  // The management apparatus, withheld from the subject.
  if (!subjectOnlyView) {
    tabs.push(
      {
        id: "workflow",
        label: "Workflow",
        icon: GaugeIcon,
        render: () => (
          <AppraisalWorkflowTimeline
            status={appraisal.status}
            reviewLevel={appraisal.reviewLevel}
            reviewerNames={appraisal.reviewerNames}
            transitions={appraisal.transitions}
          />
        ),
      },
      {
        id: "reviewers",
        label: "Reviewers",
        icon: NetworkIcon,
        render: () => <ManagerChain appraisal={appraisal} />,
      }
    )
  }

  tabs.push({
    id: "deadlines",
    label: "Deadlines",
    icon: CalendarDaysIcon,
    render: () => (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Deadline label="Self-appraisal" date={appraisal.cycle.employeeSubmissionDeadline} />
        <Deadline label="Manager reviews" date={appraisal.cycle.primaryReviewDeadline} />
        <Deadline label="Final review" date={appraisal.cycle.finalizationDeadline} />
      </div>
    ),
  })

  if (!subjectOnlyView && appraisal.scoreOverrides.length > 0) {
    tabs.push({
      id: "calibration",
      label: "Calibration",
      icon: GaugeIcon,
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

  const requestedTab = searchParams.get("tab")
  const activeTab = tabs.find((tab) => tab.id === requestedTab) ?? tabs[0]

  function selectTab(id: string) {
    const params = new URLSearchParams(Array.from(searchParams.entries()))
    params.set("tab", id)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  // Everything that helps rather than IS the form — progress and score, the
  // rating guide, the workbook route — behind one Tools button in the step's
  // heading (beside "Total weight" on Performance areas).
  const toolsMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon-sm" aria-label="Tools" title="Tools">
            <MenuIcon className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => setToolPanel("progress")}>
          <TargetIcon className="size-4" /> Your progress &amp; score
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setToolPanel("guide")}>
          <BookOpenIcon className="size-4" /> Rating guide
        </DropdownMenuItem>
        {viewer.canSubmitSelf && (
          <>
            <DropdownMenuSeparator />
            {/* A real link: the workbook is a streamed download. */}
            <DropdownMenuItem render={<a href={appraisalsApi.exportUrl(appraisal.id)} />}>
              <DownloadIcon className="size-4" /> Download workbook
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => importRef.current?.openFilePicker()}>
              <UploadIcon className="size-4" /> Upload filled file
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const primaryAction = isLast ? (
    <Button
      className="gap-1.5 bg-role-hr text-role-hr-foreground shadow-2xs hover:bg-role-hr/90"
      disabled={isPending || !canSubmit}
      onClick={submit}
    >
      {isPending
        ? "Submitting…"
        : viewer.canSubmitReview
          ? "Submit review"
          : "Submit self-appraisal"}
      <CheckIcon className="size-4" />
    </Button>
  ) : (
    <Button
      className="gap-1.5 bg-role-hr text-role-hr-foreground shadow-2xs hover:bg-role-hr/90"
      onClick={() => goTo(stepIndex + 1)}
    >
      Next <ArrowRightIcon className="size-4" />
    </Button>
  )

  return (
    <RatingScaleContext value={ratingScale}>
      <div className="grid gap-4">
        <AppraisalHeader
          appraisal={appraisal}
          saving={saveDraft?.isPending ?? false}
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

        <section className="rounded-xl border bg-card p-4 shadow-2xs sm:p-5">
          {activeTab.render()}
        </section>
      </div>
    </RatingScaleContext>
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
        {date
          ? new Date(date).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "—"}
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
          <h1 className="truncate text-lg font-semibold tracking-tight">
            {appraisal.employeeName}
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            {[employee?.designationTitle, employee?.departmentName].filter(Boolean).join(" · ") ||
              appraisal.template.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {appraisal.employeeCode && <span>{appraisal.employeeCode}</span>}
            {appraisal.primaryManagerName && (
              <span>Reporting to {appraisal.primaryManagerName}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
        <AppraisalStatusBadge status={appraisal.status} reviewLevel={appraisal.reviewLevel} />
        <p className="text-sm font-medium">{appraisal.cycleName}</p>
        {(appraisal.cycle.assessmentPeriodStart || appraisal.cycle.assessmentPeriodEnd) && (
          <p className="text-xs text-muted-foreground">
            {formatDate(appraisal.cycle.assessmentPeriodStart)} –{" "}
            {formatDate(appraisal.cycle.assessmentPeriodEnd)}
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
  return value
    ? new Date(value).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—"
}

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
  templatePerspectives,
  canAssess,
  valueOf,
  onChange,
}: {
  templatePerspectives: NonNullable<AppraisalDetail["template"]["structure"]>["perspectives"]
  canAssess: boolean
  valueOf: (key: string) => string
  onChange: (key: string, next: string) => void
}) {
  const defined = templatePerspectives ?? []
  const keyFor = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Performance perspectives</h2>
        <p className="text-sm text-muted-foreground">
          {canAssess
            ? "Rate this employee against each perspective and record the evidence behind it."
            : "How this appraisal is weighted across the perspectives."}
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
                  <div className="mt-1 grid gap-3 border-t pt-3 md:grid-cols-[minmax(0,45fr)_minmax(0,50fr)] md:gap-x-[5%]">
                    <div className="grid gap-1">
                      <p className="text-xs font-semibold">Manager rating</p>
                      <RatingSelect
                        value={Number(valueOf(base + MANAGER_RATING_SUFFIX)) || null}
                        onChange={(rating) =>
                          onChange(base + MANAGER_RATING_SUFFIX, String(rating))
                        }
                      />
                    </div>
                    <div className="grid gap-1">
                      <label htmlFor={`perspective-${base}`} className="text-xs font-semibold">
                        Manager summary / evidence
                      </label>
                      <textarea
                        id={`perspective-${base}`}
                        rows={3}
                        value={valueOf(base + MANAGER_SUMMARY_SUFFIX)}
                        onChange={(event) =>
                          onChange(base + MANAGER_SUMMARY_SUFFIX, event.target.value)
                        }
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
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
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
  documentsMissing,
  onGoToStep,
}: {
  appraisal: AppraisalDetail
  categories: AppraisalDetail["template"]["categories"]
  answers: AnswerState
  sections: TemplateWizardSection[]
  valueOf: (key: string) => string
  /** Undefined hides the stat — for the employee, who is never shown a score. */
  weightedScore?: number | null
  outstanding: { id: string; where: string; reason: string }[]
  /** Aadhaar/PAN still missing — the warning at the top of the form says so. */
  documentsMissing: boolean
  onGoToStep: (key: string) => void
}) {
  // The top of the template's own rating scale — not a fixed 5.
  const ratingMax = useRatingScale().at(-1)?.value ?? 5
  const complete = outstanding.length === 0
  const totalQuestions = categories.reduce((sum, category) => sum + category.questions.length, 0)

  return (
    <div className="grid gap-4">
      {/* Not the green "go ahead and submit" while documents are still
          missing — that would contradict the warning above and the disabled
          Submit button. The form's own state is then left to the warning. */}
      {!(complete && documentsMissing) && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3 text-sm",
            complete
              ? "border-success/40 bg-success/5 text-success"
              : "border-warning/40 bg-warning/5 text-warning"
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
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => onGoToStep("areas")}
              >
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
      )}

      <div className={cn("grid gap-2", weightedScore === undefined ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
        {weightedScore !== undefined && (
          <Stat
            label="Weighted score"
            value={weightedScore != null ? weightedScore.toFixed(2) : "—"}
          />
        )}
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
            const average = ratings.length
              ? ratings.reduce((a, b) => a + b, 0) / ratings.length
              : null
            return (
              <li
                key={category.id}
                className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm"
              >
                <span className="min-w-0 truncate">{category.name}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="tabular-nums">
                    {Number(category.weight)}%
                  </Badge>
                  <span className={cn("tabular-nums", average == null && "text-warning")}>
                    {average != null ? `${formatRating(average)} / ${ratingMax}` : "Not rated"}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </SummaryBlock>

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
        {appraisal.viewer.canSubmitSelf
          ? (appraisal.managers[0]?.employee?.fullName ?? "Admin / HR for the final review")
          : appraisal.status === "manager_review" && appraisal.reviewLevel != null
            ? (appraisal.managers[appraisal.reviewLevel]?.employee?.fullName ?? "Admin / HR for the final review")
            : "the next step"}
        . After that it is locked, and any change has to come back as a correction.
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

/** The reviewer chain this appraisal was snapshotted against, then Admin/HR. */
function ManagerChain({ appraisal }: { appraisal: AppraisalDetail }) {
  return (
    <ul className="grid gap-2">
      {appraisal.managers.map(({ level, employee }) =>
        employee ? (
          <li key={level} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
            <span className="text-xs text-muted-foreground">Level {level} manager</span>
            <span className="text-sm font-medium">{employee.fullName}</span>
          </li>
        ) : null
      )}
      <li className="flex items-center justify-between gap-2 rounded-lg border border-dashed p-2.5">
        <span className="text-xs text-muted-foreground">Final review</span>
        <span className="text-sm font-medium">Admin / HR</span>
      </li>
    </ul>
  )
}

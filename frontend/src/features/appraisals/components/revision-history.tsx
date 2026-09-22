"use client"

import { useMemo, useState } from "react"
import { ChevronDownIcon, LockIcon, ArrowUpIcon, ArrowDownIcon, PlusIcon, MinusIcon } from "lucide-react"
import { cn } from "cn"

import { Badge } from "@/components/ui/badge"
import { RevisionBadge } from "@/features/appraisals/components/appraisal-badges"
import { appraisalStageMeta, APPRAISAL_STATUS_LABELS, RATING_SCALE } from "@/features/appraisals/constants"
import type { AppraisalDetail, AppraisalRevision } from "@/types/appraisals"

function questionPrompt(appraisal: AppraisalDetail, questionId: string) {
  for (const category of appraisal.template.categories) {
    const question = category.questions.find((q) => String(q.id) === String(questionId))
    if (question) return { prompt: question.prompt, category: category.name }
  }
  return { prompt: "Question", category: "" }
}

function ratingLabel(rating: number | null) {
  return RATING_SCALE.find((option) => option.value === rating)?.label ?? null
}

const NARRATIVE_ROWS: { key: keyof AppraisalRevision; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "achievements", label: "Achievements" },
  { key: "strengths", label: "Strengths" },
  { key: "improvementAreas", label: "Areas to improve" },
  { key: "trainingNeeds", label: "Training needs" },
  { key: "nextPeriodGoals", label: "Next period goals" },
]

/**
 * What one version changed relative to the one before it.
 *
 * The comparison is against the PREVIOUS VISIBLE version, which is the honest
 * one to draw: if a stage was filtered out for this viewer, pretending to diff
 * against it would leak the very thing the filter withheld.
 */
function ratingDelta(revision: AppraisalRevision, previous: AppraisalRevision | undefined, questionId: string) {
  if (!previous) return null
  const before = previous.answers.find((a) => String(a.appraisalTemplateQuestionId) === String(questionId))
  if (!before) return { kind: "new" as const }

  const now = revision.answers.find((a) => String(a.appraisalTemplateQuestionId) === String(questionId))
  if (before.rating == null || now?.rating == null) return null
  const delta = now.rating - before.rating
  return delta === 0 ? { kind: "same" as const } : { kind: "changed" as const, delta, from: before.rating }
}

function DeltaChip({ delta }: { delta: ReturnType<typeof ratingDelta> }) {
  if (!delta || delta.kind === "same") return null
  if (delta.kind === "new") {
    return (
      <span className="flex items-center gap-0.5 rounded-full bg-info/15 px-1.5 py-0.5 text-[10px] font-medium text-info">
        <PlusIcon className="size-2.5" /> new
      </span>
    )
  }
  const up = delta.delta > 0
  return (
    <span
      className={cn(
        "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
        up ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
      )}
    >
      {up ? <ArrowUpIcon className="size-2.5" /> : <ArrowDownIcon className="size-2.5" />}
      {up ? "+" : ""}
      {delta.delta} from {delta.from}
    </span>
  )
}

/**
 * Every version this viewer is permitted to see, newest first, each expandable
 * and each standing on its own: V1, V2, V3 and anything a correction added
 * afterwards are separate immutable records, never overwritten (§11).
 *
 * A Final Reviewer sees the whole chain — who wrote each version, when, at
 * which stage, the score it produced, every rating and comment, and what each
 * one changed relative to the version before it.
 *
 * What is NOT here matters as much as what is: the server sends only the
 * revisions this person may read (AppraisalPolicy#visible_revision_stages), so
 * an employee looking at their own appraisal before release simply receives
 * one revision — their own. The note below explains that gap rather than
 * leaving it looking like an error.
 */
export function RevisionHistory({ appraisal }: { appraisal: AppraisalDetail }) {
  // Oldest → newest, which is the order a diff has to be computed in.
  const chronological = useMemo(
    () => [...appraisal.revisions].sort((a, b) => a.versionNumber - b.versionNumber),
    [appraisal.revisions]
  )
  const [openId, setOpenId] = useState<string | null>(chronological.at(-1)?.id ?? null)

  if (chronological.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
        Nothing submitted yet.
      </p>
    )
  }

  const hidden = appraisal.viewer.isSubject && !appraisal.viewer.isAdministrator && !appraisal.releasedAt
  const latestId = chronological.at(-1)?.id

  return (
    <div className="grid gap-2">
      <p className="text-xs text-muted-foreground">
        {chronological.length} version{chronological.length === 1 ? "" : "s"} · each one is kept exactly as it was
        submitted.
      </p>

      {[...chronological].reverse().map((revision) => {
        const open = openId === revision.id
        const index = chronological.findIndex((r) => r.id === revision.id)
        const previous = index > 0 ? chronological[index - 1] : undefined
        const stage = appraisalStageMeta(revision.stage)
        // The workflow state this version moved the appraisal into — read from
        // the transition log rather than guessed from the stage name.
        const transition = [...appraisal.transitions]
          .filter((t) => new Date(t.createdAt) >= new Date(revision.submittedAt))
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]

        return (
          <div
            key={revision.id}
            className={cn("overflow-hidden rounded-lg border", revision.id === latestId && "border-role-hr/40")}
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : revision.id)}
              className="flex w-full flex-wrap items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-accent"
            >
              <RevisionBadge stage={revision.stage} versionNumber={revision.versionNumber} />
              <div className="min-w-0">
                <p className="text-sm font-medium">{revision.authorName ?? "Unknown"}</p>
                <p className="text-[11px] text-muted-foreground">
                  {stage.label} ·{" "}
                  {new Date(revision.submittedAt).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                {transition && (
                  <Badge variant="outline" className="text-[10px]">
                    {APPRAISAL_STATUS_LABELS[transition.toStatus] ?? transition.toStatus}
                  </Badge>
                )}
                {revision.id === latestId && <Badge className="bg-role-hr/15 text-role-hr">Current</Badge>}
                {revision.calculatedScore != null && (
                  <Badge variant="outline" className="tabular-nums">
                    {Number(revision.calculatedScore).toFixed(2)}
                  </Badge>
                )}
                <ChevronDownIcon
                  className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
                />
              </div>
            </button>

            {open && (
              <div className="grid gap-3 border-t bg-muted/20 p-3">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span>
                    Created by <span className="font-medium text-foreground">{revision.authorName ?? "Unknown"}</span>
                  </span>
                  <span>
                    {revision.answers.length} rating{revision.answers.length === 1 ? "" : "s"}
                  </span>
                  {previous ? (
                    <span>Compared with {previous.label}</span>
                  ) : (
                    <span>First version — nothing to compare with</span>
                  )}
                  <span className="flex items-center gap-1">
                    <LockIcon className="size-3" /> Immutable
                  </span>
                </div>

                {revision.answers.length > 0 && (
                  <ul className="grid gap-2">
                    {revision.answers.map((answer) => {
                      const meta = questionPrompt(appraisal, answer.appraisalTemplateQuestionId)
                      const delta = ratingDelta(revision, previous, answer.appraisalTemplateQuestionId)
                      return (
                        <li key={answer.id} className="grid gap-0.5 rounded-lg bg-card p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium">{meta.prompt}</p>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <DeltaChip delta={delta} />
                              <Badge variant="outline" className="tabular-nums">
                                {answer.rating ?? "—"}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {meta.category}
                            {meta.category && ratingLabel(answer.rating) && " · "}
                            {ratingLabel(answer.rating)}
                          </p>
                          {answer.comment && <p className="mt-1 text-xs whitespace-pre-wrap">{answer.comment}</p>}
                        </li>
                      )
                    })}
                  </ul>
                )}

                {NARRATIVE_ROWS.filter((row) => revision[row.key]).map((row) => {
                  const changed = previous ? previous[row.key] !== revision[row.key] : false
                  return (
                    <div key={String(row.key)} className="grid gap-0.5 rounded-lg bg-card p-2.5">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                        {row.label}
                        {changed && (
                          <span className="rounded-full bg-info/15 px-1.5 py-0.5 text-[10px] font-medium text-info">
                            rewritten in this version
                          </span>
                        )}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{String(revision[row.key])}</p>
                    </div>
                  )
                })}

                {/* Silence is meaningful in a version history: a reader should
                    be told a field was dropped, not left to notice. */}
                {previous &&
                  NARRATIVE_ROWS.filter((row) => previous[row.key] && !revision[row.key]).map((row) => (
                    <p
                      key={`${String(row.key)}-removed`}
                      className="flex items-center gap-1.5 rounded-lg bg-card px-2.5 py-2 text-[11px] text-muted-foreground"
                    >
                      <MinusIcon className="size-3" />
                      {row.label} was left blank in this version.
                    </p>
                  ))}
              </div>
            )}
          </div>
        )
      })}

      {hidden && (
        <p className="flex items-start gap-1.5 rounded-lg bg-muted/50 px-2.5 py-2 text-xs text-muted-foreground">
          <LockIcon className="mt-px size-3.5 shrink-0" />
          <span>
            Manager reviews stay private until your appraisal is released. You&apos;ll see the final version here
            once HR releases it.
          </span>
        </p>
      )}
    </div>
  )
}

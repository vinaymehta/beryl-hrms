"use client"

import { cn } from "cn"
import { LockIcon, StarIcon, TriangleAlertIcon } from "lucide-react"

import { formatRating, isNarrativeKey, SIGNIFICANT_RATING_GAP } from "@/features/appraisals/constants"
import type { AppraisalRevision } from "@/types/appraisals"

/** One earlier version's answer to the question being filled in. */
export interface PreviousEntry {
  id: string
  /** "V1", "V2"… */
  version: string
  /** Who wrote it, and in what role: "Employee", "Level 1 manager"… */
  who: string
  role: string
  isEmployee: boolean
  rating?: number | null
  text: string | null
}

/**
 * The versions a reviewer writes on top of, oldest first: the employee's own
 * V1, then each manager level's — the latest of each, and only what the
 * server already let this person see (AppraisalPolicy#visible_revision?).
 * The version being written now is left out.
 */
export function priorRevisions(
  revisions: AppraisalRevision[],
  current: { stage: string; level: number | null }
) {
  const latest = new Map<string, AppraisalRevision>()
  for (const revision of revisions) {
    const slot = `${revision.stage}:${revision.reviewLevel ?? ""}`
    if (revision.stage === current.stage && (revision.reviewLevel ?? null) === current.level) continue
    const held = latest.get(slot)
    if (!held || revision.versionNumber > held.versionNumber) latest.set(slot, revision)
  }
  return [...latest.values()].sort((a, b) => a.versionNumber - b.versionNumber)
}

function roleOf(revision: AppraisalRevision) {
  if (revision.stage === "self_appraisal") return "Employee"
  if (revision.stage === "final_review") return "Final review"
  return revision.reviewLevel ? `Level ${revision.reviewLevel} manager` : "Manager"
}

/** Each earlier version's rating and comments for one question. */
export function previousAnswers(revisions: AppraisalRevision[], questionId: string): PreviousEntry[] {
  return revisions.flatMap((revision) => {
    const answer = revision.answers.find((entry) => String(entry.appraisalTemplateQuestionId) === questionId)
    if (!answer || (answer.rating == null && !answer.comment)) return []
    return [
      {
        id: revision.id,
        version: revision.label,
        who: revision.authorName ?? roleOf(revision),
        role: roleOf(revision),
        isEmployee: revision.stage === "self_appraisal",
        rating: answer.rating,
        text: answer.comment,
      },
    ]
  })
}

/** Each earlier version's answer to one written field. */
export function previousResponses(revisions: AppraisalRevision[], key: string): PreviousEntry[] {
  return revisions.flatMap((revision) => {
    const text = isNarrativeKey(key) ? revision[key] : revision.responses?.[key]
    if (!text?.trim()) return []
    return [
      {
        id: revision.id,
        version: revision.label,
        who: revision.authorName ?? roleOf(revision),
        role: roleOf(revision),
        isEmployee: revision.stage === "self_appraisal",
        text,
      },
    ]
  })
}

/**
 * Each earlier manager's rating and evidence for one perspective — kept in a
 * revision's `responses` under the perspective key plus a suffix
 * (SubmitRevision::MANAGER_RATING_SUFFIX / MANAGER_SUMMARY_SUFFIX). Only
 * reviewers rate perspectives, so the employee's V1 never has one.
 */
export function previousPerspective(
  revisions: AppraisalRevision[],
  ratingKey: string,
  summaryKey: string
): PreviousEntry[] {
  return revisions.flatMap((revision) => {
    const rating = Number(revision.responses?.[ratingKey]) || null
    const text = revision.responses?.[summaryKey] ?? null
    if (rating == null && !text?.trim()) return []
    return [
      {
        id: revision.id,
        version: revision.label,
        who: revision.authorName ?? roleOf(revision),
        role: roleOf(revision),
        isEmployee: false,
        rating,
        text,
      },
    ]
  })
}

/**
 * Read-only, above the reviewer's own inputs: one line per earlier version —
 * V1 · name (role) · rating · comment. `myRating` flags a big gap from the employee's own
 * rating (scope §12).
 */
export function PreviousFeedback({
  entries,
  myRating,
}: {
  entries: PreviousEntry[]
  myRating?: number | null
}) {
  if (entries.length === 0) return null
  const employee = entries.find((entry) => entry.isEmployee)
  const gap = employee?.rating != null && myRating != null ? myRating - employee.rating : null
  const significantGap = gap != null && Math.abs(gap) >= SIGNIFICANT_RATING_GAP

  return (
    <div className="grid gap-1.5">
      {/* Set apart from the inputs below it — a tinted, left-ruled panel
          with its own caption — so what was written before can't be
          mistaken for a field to fill. One line per version, in columns:
          V1 · name · rating · comment. */}
      <div className="overflow-hidden rounded-lg border border-l-4 border-l-role-hr/70 bg-muted/60 dark:bg-muted/30">
        <p className="flex items-center gap-1.5 px-3 pt-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          <LockIcon className="size-3" />
          Previous feedback · read only
        </p>
        {/* The form's own 45 / 50 split, so each comment sits right above
            "Your comments & evidence" and the line spans the full width. */}
        <ul className="grid px-3 pb-1 text-sm">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className={cn(
                "grid items-start gap-y-1 border-b border-border/60 py-2 last:border-0",
                // A written answer sits over a full-width box, so its text
                // starts right after the name instead.
                entry.rating === undefined
                  ? "gap-x-4 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]"
                  : "gap-x-[5%] md:grid-cols-[minmax(0,45fr)_minmax(0,50fr)]"
              )}
            >
              <span className="flex min-w-0 items-center gap-3 md:pt-1.5">
                <span className="w-7 shrink-0 rounded-md bg-role-hr py-0.5 text-center text-[11px] font-bold text-role-hr-foreground tabular-nums">
                  {entry.version}
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-2 font-semibold text-foreground">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background text-[10px] font-semibold text-muted-foreground ring-1 ring-border">
                    {initials(entry.who)}
                  </span>
                  <span className="truncate">
                    {entry.who}
                    {entry.who !== entry.role && (
                      <span className="font-normal text-muted-foreground"> ({entry.role})</span>
                    )}
                  </span>
                </span>
                {entry.rating !== undefined && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs font-semibold tabular-nums">
                    <StarIcon className="size-3.5 fill-role-hr text-role-hr" />
                    {entry.rating == null ? "—" : formatRating(entry.rating)}
                  </span>
                )}
              </span>
              {/* Read-only, in a box shaped like the feedback box below it —
                  two lines tall, growing with what was written. */}
              <span className="min-h-14 rounded-lg border border-input bg-background px-2.5 py-2 whitespace-pre-line text-foreground dark:bg-input/30">
                {entry.text?.trim() || <span className="text-muted-foreground">—</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {significantGap && (
        <p className="flex items-center gap-1 text-xs font-medium text-warning">
          <TriangleAlertIcon className="size-3.5" />
          {gap > 0
            ? `You rated ${formatRating(gap)} higher than the employee`
            : `You rated ${formatRating(Math.abs(gap))} lower than the employee`}
        </p>
      )}
    </div>
  )
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

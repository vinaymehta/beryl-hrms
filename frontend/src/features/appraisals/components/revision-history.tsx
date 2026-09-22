"use client"

import { useState } from "react"
import { ChevronDownIcon, LockIcon } from "lucide-react"
import { cn } from "cn"

import { Badge } from "@/components/ui/badge"
import { RevisionBadge } from "@/features/appraisals/components/appraisal-badges"
import type { AppraisalDetail, AppraisalRevision } from "@/types/appraisals"

function questionPrompt(appraisal: AppraisalDetail, questionId: string) {
  for (const category of appraisal.template.categories) {
    const question = category.questions.find((q) => String(q.id) === String(questionId))
    if (question) return { prompt: question.prompt, category: category.name }
  }
  return { prompt: "Question", category: "" }
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
 * Every version this viewer is permitted to see, newest first, each expandable.
 *
 * What is NOT here matters as much as what is: the server sends only the
 * revisions this person may read (AppraisalPolicy#visibleRevisionStages), so an
 * employee looking at their own appraisal before release simply receives one
 * revision — their own. The note below explains the gap rather than leaving it
 * looking like an error.
 */
export function RevisionHistory({ appraisal }: { appraisal: AppraisalDetail }) {
  const [openId, setOpenId] = useState<string | null>(appraisal.revisions.at(-1)?.id ?? null)
  const ordered = [...appraisal.revisions].sort((a, b) => b.versionNumber - a.versionNumber)

  if (ordered.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
        Nothing submitted yet.
      </p>
    )
  }

  const hidden = appraisal.viewer.isSubject && !appraisal.viewer.isAdministrator && !appraisal.releasedAt

  return (
    <div className="grid gap-2">
      {ordered.map((revision) => {
        const open = openId === revision.id
        return (
          <div key={revision.id} className="overflow-hidden rounded-lg border">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : revision.id)}
              className="flex w-full flex-wrap items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-accent"
            >
              <RevisionBadge stage={revision.stage} versionNumber={revision.versionNumber} />
              <span className="text-sm font-medium">{revision.authorName ?? "Unknown"}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(revision.submittedAt).toLocaleDateString()}
              </span>
              {revision.calculatedScore != null && (
                <Badge variant="outline" className="tabular-nums">
                  {Number(revision.calculatedScore).toFixed(2)}
                </Badge>
              )}
              <ChevronDownIcon
                className={cn("ml-auto size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
              />
            </button>

            {open && (
              <div className="grid gap-3 border-t bg-muted/20 p-3">
                {revision.answers.length > 0 && (
                  <ul className="grid gap-2">
                    {revision.answers.map((answer) => {
                      const meta = questionPrompt(appraisal, answer.appraisalTemplateQuestionId)
                      return (
                        <li key={answer.id} className="grid gap-0.5 rounded-lg bg-card p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium">{meta.prompt}</p>
                            <Badge variant="outline" className="shrink-0 tabular-nums">
                              {answer.rating ?? "—"}
                            </Badge>
                          </div>
                          {meta.category && <p className="text-[11px] text-muted-foreground">{meta.category}</p>}
                          {answer.comment && <p className="mt-1 text-xs whitespace-pre-wrap">{answer.comment}</p>}
                        </li>
                      )
                    })}
                  </ul>
                )}

                {NARRATIVE_ROWS.filter((row) => revision[row.key]).map((row) => (
                  <div key={String(row.key)} className="grid gap-0.5 rounded-lg bg-card p-2.5">
                    <p className="text-[11px] font-semibold text-muted-foreground">{row.label}</p>
                    <p className="text-sm whitespace-pre-wrap">{String(revision[row.key])}</p>
                  </div>
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

"use client"

import { useMemo, useState } from "react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRatingScale } from "@/features/appraisals/components/rating-select"
import { templateFieldAudience } from "@/features/appraisals/constants"
import { useSaveDiscussion } from "@/features/appraisals/hooks/use-appraisal-mutations"
import { useDesignations } from "@/features/employees/hooks/use-employees"
import type { AppraisalDetail, AppraisalRevision } from "@/types/appraisals"

/**
 * The Discussion step — Admin/HR only, before the appraisal is released.
 *
 * Comes after Admin/HR have filled their own Final review. Read-only, fetched
 * from the versions already submitted:
 *   • Overall Performance — the highest manager level's score (an Admin/HR
 *     score override replaces it when one has been made);
 *   • Employee Final — the employee's self-appraisal score and final comments;
 *   • Manager Final — each manager level's score, final comments and
 *     promotion recommendation;
 *   • Admin/HR's own Final review score.
 *
 * Chosen here by Admin/HR: the increment, and whether to promote (and to
 * which job title).
 */
export function DiscussionPanel({ appraisal }: { appraisal: AppraisalDetail }) {
  const ratingMax = useRatingScale().at(-1)?.value ?? 5
  const names = appraisal.reviewerNames

  // The latest submitted version at each manager level, and the employee's own.
  const { selfRevision, finalRevision, levelRevisions } = useMemo(() => {
    const latest = (list: AppraisalRevision[]) => list.sort((a, b) => b.versionNumber - a.versionNumber)[0]
    const self = latest(appraisal.revisions.filter((r) => r.stage === "self_appraisal"))
    const final = latest(appraisal.revisions.filter((r) => r.stage === "final_review"))
    const byLevel = new Map<number, AppraisalRevision>()
    for (const revision of appraisal.revisions) {
      if (revision.stage !== "manager_review" || !revision.reviewLevel) continue
      const held = byLevel.get(revision.reviewLevel)
      if (!held || revision.versionNumber > held.versionNumber) byLevel.set(revision.reviewLevel, revision)
    }
    return {
      selfRevision: self,
      finalRevision: final,
      levelRevisions: [...byLevel.entries()].sort(([a], [b]) => a - b),
    }
  }, [appraisal.revisions])

  const lastManager = levelRevisions.at(-1)?.[1]
  const overall = appraisal.finalScore ?? lastManager?.calculatedScore ?? null
  const overridden = appraisal.finalScore != null

  const finalSection = appraisal.template.structure?.wizardSections?.find((s) => s.key === "final_review")
  const fields = finalSection?.fields ?? []
  const audienceOf = (field: (typeof fields)[number]) =>
    templateFieldAudience("final_review", field, finalSection?.audience)
  const employeeFields = fields.filter((field) => audienceOf(field) === "employee")
  const managerFields = fields.filter((field) => audienceOf(field) !== "employee")

  return (
    <div className="grid gap-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Discussion</h2>
        <p className="text-sm text-muted-foreground">
          Admin/HR only. Review what the employee and each manager said, choose the increment and
          promotion, then release the appraisal to the employee.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ReadOnlyBlock label="Overall Performance">
          <p className="text-2xl leading-none font-bold tabular-nums">
            {overall == null ? "—" : Number(overall).toFixed(1)}
            <span className="text-base font-normal text-muted-foreground"> / {ratingMax}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {overridden
              ? "Calibrated score (override)"
              : lastManager
                ? `From the level ${lastManager.reviewLevel} manager review${names[(lastManager.reviewLevel ?? 1) - 1] ? ` · ${names[(lastManager.reviewLevel ?? 1) - 1]}` : ""}`
                : "No manager review yet"}
          </p>
        </ReadOnlyBlock>
      </div>

      {/* Employee Final: their own score and final comments. */}
      <ReadOnlyBlock label="Employee Final">
        <Score value={selfRevision?.calculatedScore} max={ratingMax} caption="Self-appraisal score" />
        {employeeFields.map((field) => (
          <Labelled key={field.key} label={field.label}>
            <Answer text={selfRevision?.responses?.[field.key]} />
          </Labelled>
        ))}
      </ReadOnlyBlock>

      {/* Manager Final: every level's score, comments and recommendation. */}
      <ReadOnlyBlock label="Manager Final">
        {levelRevisions.length === 0 ? (
          <Answer text={null} />
        ) : (
          <ul className="grid gap-3">
            {levelRevisions.map(([level, revision]) => (
              <li key={level} className="grid gap-1.5 rounded-lg border bg-background p-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  Level {level}
                  {names[level - 1] ? ` · ${names[level - 1]}` : ""}
                </p>
                <Score value={revision.calculatedScore} max={ratingMax} caption="Review score" />
                {managerFields.map((field) => (
                  <Labelled key={field.key} label={field.label}>
                    <Answer text={revision.responses?.[field.key]} />
                  </Labelled>
                ))}
              </li>
            ))}
          </ul>
        )}
      </ReadOnlyBlock>

      <ReadOnlyBlock label="Admin / HR Final review">
        <Score value={finalRevision?.calculatedScore} max={ratingMax} caption="Final review score" />
      </ReadOnlyBlock>

      {appraisal.discussion && <DecisionForm appraisal={appraisal} />}
    </div>
  )
}

/** Increment % and promotion — the part Admin/HR choose. */
function DecisionForm({ appraisal }: { appraisal: AppraisalDetail }) {
  const saved = appraisal.discussion!
  const save = useSaveDiscussion(appraisal.id)
  const { data: designations } = useDesignations()

  const [increment, setIncrement] = useState(saved.incrementPercentage ?? "")
  const [promote, setPromote] = useState<boolean | null>(saved.promote)
  const [designationId, setDesignationId] = useState(saved.proposedDesignationId ?? "")
  const [reason, setReason] = useState(saved.promotionReason ?? "")

  const readOnly = !saved.canEdit
  const incrementOk = increment === "" || (Number(increment) >= -100 && Number(increment) <= 500)
  const promotionOk = promote !== true || designationId !== ""

  return (
    <section className="grid gap-4 rounded-xl border p-4">
      <div>
        <h3 className="text-sm font-semibold">Admin / HR decision</h3>
        <p className="text-xs text-muted-foreground">
          {readOnly ? "Recorded before release." : "Saved on the appraisal; the employee sees the released appraisal."}
        </p>
      </div>

      <div className="grid gap-1.5 sm:max-w-xs">
        <Label htmlFor="discussion-increment">Increment (%)</Label>
        <Input
          id="discussion-increment"
          type="number"
          step="0.01"
          min="-100"
          max="500"
          placeholder="e.g. 8"
          value={increment}
          disabled={readOnly || save.isPending}
          onChange={(event) => setIncrement(event.target.value)}
          aria-invalid={!incrementOk}
        />
      </div>

      <div className="grid gap-1.5">
        <Label>Promotion</Label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Promotion">
          {[
            { value: true, label: "Promote" },
            { value: false, label: "No promotion" },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={promote === option.value}
              disabled={readOnly || save.isPending}
              onClick={() => setPromote(option.value)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-60",
                promote === option.value
                  ? "border-role-hr bg-role-hr/12 font-medium text-role-hr"
                  : "hover:bg-muted"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {promote === true && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="discussion-designation">New job title</Label>
            <Select
              items={designations?.map((d) => ({ value: String(d.id), label: d.title }))}
              value={designationId || null}
              onValueChange={(next) => setDesignationId(next ?? "")}
              disabled={readOnly || save.isPending}
            >
              <SelectTrigger id="discussion-designation" className="h-9 w-full">
                <SelectValue placeholder={saved.proposedDesignationTitle ?? "Select a job title"} />
              </SelectTrigger>
              <SelectContent>
                {designations?.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!promotionOk && <p className="text-xs text-destructive">Choose the new job title</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="discussion-reason">Reason</Label>
            <Input
              id="discussion-reason"
              value={reason}
              disabled={readOnly || save.isPending}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why the promotion"
            />
          </div>
        </div>
      )}

      {!readOnly && (
        <Button
          className="w-fit"
          disabled={!incrementOk || !promotionOk || save.isPending}
          onClick={() =>
            save.mutate({
              incrementPercentage: increment,
              promote,
              proposedDesignationId: promote ? designationId : "",
              promotionReason: promote ? reason : "",
            })
          }
        >
          {save.isPending ? "Saving…" : "Save decision"}
        </Button>
      )}
    </section>
  )
}

function Score({ value, max, caption }: { value?: string | number | null; max: number; caption: string }) {
  return (
    <p className="text-sm">
      <span className="text-lg font-semibold tabular-nums">{value == null ? "—" : Number(value).toFixed(1)}</span>
      <span className="text-muted-foreground"> / {max}</span>
      <span className="ml-2 text-xs text-muted-foreground">{caption}</span>
    </p>
  )
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function ReadOnlyBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 rounded-xl border bg-muted/20 p-3">
      <p className="text-xs font-semibold text-foreground">{label}</p>
      {children}
    </div>
  )
}

function Answer({ text }: { text?: string | null }) {
  return text?.trim() ? (
    <p className="text-sm whitespace-pre-wrap text-foreground">{text}</p>
  ) : (
    <p className="text-sm text-muted-foreground italic">Not answered</p>
  )
}

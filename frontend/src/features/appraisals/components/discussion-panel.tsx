"use client"

import { useMemo, useState } from "react"
import { cn } from "cn"

import { DownloadIcon, FileTextIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { InfoTip } from "@/components/ui/tooltip"
import { appraisalsApi } from "@/features/appraisals/api"
import { LetterWindow } from "@/features/appraisals/components/appraisal-letter"
import { useRatingScale } from "@/features/appraisals/components/rating-select"
import { templateFieldAudience } from "@/features/appraisals/constants"
import { useSaveDiscussion } from "@/features/appraisals/hooks/use-appraisal-mutations"
import {
  BREAKDOWN_ROWS,
  DEFAULT_SALARY_RULES,
  EMPTY_BREAKDOWN,
  annualCtc,
  breakdownFromRules,
  breakdownFromServer,
  inrNumber,
  monthlyGross,
  roundPaise,
  rupees,
  type BreakdownValues,
} from "@/features/appraisals/salary-structure"
import { useDesignations } from "@/features/employees/hooks/use-employees"
import type { AppraisalDetail, AppraisalRevision, BreakdownKey } from "@/types/appraisals"

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
 * Chosen here by Admin/HR: the current and new monthly gross, its breakdown
 * into the letter's compensation table, the effective and next-appraisal
 * dates, and whether to promote (and to which job title).
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
          Admin/HR only. Review what the employee and each manager said, record the new salary and its
          breakdown, the dates and any promotion, then release the letter to the employee.
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

/**
 * The part Admin/HR choose, laid out as the appraisal letter's compensation
 * table: the current and new monthly gross, the new gross split into the
 * letter's rows, the dates, and any promotion. The table is filled from the
 * company's salary rules whenever the new gross changes; any row can then be
 * typed over, and stays as typed until the gross changes again.
 */
function DecisionForm({ appraisal }: { appraisal: AppraisalDetail }) {
  const saved = appraisal.discussion!
  const rules = saved.salaryRules ?? DEFAULT_SALARY_RULES
  const save = useSaveDiscussion(appraisal.id)
  const { data: designations } = useDesignations()

  // The current gross arrives pre-filled from the latest pay record (÷ 12)
  // until a decision is saved.
  const [currentGross, setCurrentGross] = useState(fromServer(saved.currentCompensation))
  const [increment, setIncrement] = useState(saved.incrementPercentage ?? "")
  // A saved new gross as it was saved; otherwise worked out from the start.
  const [newGross, setNewGross] = useState(
    () => fromServer(saved.approvedCompensation) || (grossAfterIncrement(currentGross, increment) ?? "")
  )
  const [breakdown, setBreakdown] = useState<BreakdownValues>(() =>
    saved.breakdown
      ? breakdownFromServer(saved.breakdown)
      : newGross !== "" && isMoney(newGross)
        ? breakdownFromRules(Number(newGross), rules)
        : EMPTY_BREAKDOWN
  )
  const [effectiveDate, setEffectiveDate] = useState(saved.effectiveDate ?? "")
  const [nextAppraisal, setNextAppraisal] = useState(
    saved.nextAppraisalOn ?? (saved.effectiveDate ? plusOneYear(saved.effectiveDate) : "")
  )
  const [promote, setPromote] = useState<boolean | null>(saved.promote)
  const [designationId, setDesignationId] = useState(saved.proposedDesignationId ?? "")
  const [reason, setReason] = useState(saved.promotionReason ?? "")

  const readOnly = !saved.canEdit
  const busy = readOnly || save.isPending
  const incrementOk = increment === "" || (Number(increment) >= -100 && Number(increment) <= 500)
  const moneyOk = [currentGross, newGross, ...Object.values(breakdown)].every(isMoney)
  const promotionOk = promote !== true || designationId !== ""
  const total = monthlyGross(breakdown)
  const hasGross = newGross !== "" && isMoney(newGross)
  const totalMatches = hasGross && roundPaise(Number(newGross)) === total
  const datesOk = !nextAppraisal || !effectiveDate || nextAppraisal > effectiveDate
  const savedLetterReady = Boolean(saved.breakdown && saved.effectiveDate)
  const [previewOpen, setPreviewOpen] = useState(false)

  // The new gross drives the table: every change to it re-fills the rows.
  const changeNewGross = (value: string) => {
    setNewGross(value)
    setBreakdown(value !== "" && isMoney(value) ? breakdownFromRules(Number(value), rules) : EMPTY_BREAKDOWN)
  }

  // New gross follows current × (1 + increment / 100) whenever either changes.
  // Typing over it is allowed, and sticks until one of the two changes again.
  const recalculate = (gross: string, percent: string) => {
    const next = grossAfterIncrement(gross, percent)
    if (next != null) changeNewGross(next)
  }

  // Next appraisal defaults to a year after the effective date, and keeps
  // following it until someone picks a different date.
  const changeEffectiveDate = (value: string) => {
    if (!nextAppraisal || (effectiveDate && nextAppraisal === plusOneYear(effectiveDate))) {
      setNextAppraisal(value ? plusOneYear(value) : "")
    }
    setEffectiveDate(value)
  }

  return (
    <section className="grid gap-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Admin / HR decision</h3>
          <p className="text-xs text-muted-foreground">
            {readOnly ? "Recorded before release." : "Saved on the appraisal and printed in the letter."}
          </p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1.5">
            {/* Download sits left of Preview, both from the last SAVED decision. */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!savedLetterReady}
              nativeButton={false}
              render={
                <a href={savedLetterReady ? appraisalsApi.letterUrl(appraisal.id, { draft: true, download: true }) : undefined} />
              }
            >
              <DownloadIcon className="size-3.5" /> Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!savedLetterReady}
              onClick={() => setPreviewOpen(true)}
            >
              <FileTextIcon className="size-3.5" /> Preview letter
            </Button>
            <LetterWindow appraisal={appraisal} draft open={previewOpen} onOpenChange={setPreviewOpen} />
            <InfoTip label="Preview letter">
              {savedLetterReady
                ? "Shows the letter as it would be sent, from the last saved decision — save first to see a change."
                : "Save the decision with an effective date to preview the letter."}
            </InfoTip>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MoneyField
          id="discussion-current-gross"
          label="Current monthly gross"
          value={currentGross}
          readOnly={readOnly}
          disabled={busy}
          tip={
            saved.currentCompensationPrefilled && currentGross === fromServer(saved.currentCompensation)
              ? "From the latest pay record: the annual compensation ÷ 12."
              : undefined
          }
          onChange={(value) => {
            setCurrentGross(value)
            recalculate(value, increment)
          }}
        />
        <div className="grid content-start gap-1.5">
          <Label htmlFor="discussion-increment">Increment (%)</Label>
          {readOnly ? (
            <p className="text-sm tabular-nums">{increment === "" ? "—" : `${Number(increment)}%`}</p>
          ) : (
            <Input
              id="discussion-increment"
              type="number"
              step="0.01"
              min="-100"
              max="500"
              placeholder="e.g. 8"
              value={increment}
              disabled={busy}
              onChange={(event) => {
                setIncrement(event.target.value)
                recalculate(currentGross, event.target.value)
              }}
              aria-invalid={!incrementOk}
            />
          )}
        </div>
        <MoneyField
          id="discussion-new-gross"
          label="New monthly gross"
          value={newGross}
          readOnly={readOnly}
          disabled={busy}
          tip="Worked out from the current gross and the increment, to the rupee. Type over it to set it yourself — the table below is re-filled from it."
          onChange={changeNewGross}
        />
      </div>

      <BreakdownTable
        breakdown={breakdown}
        readOnly={readOnly}
        disabled={busy}
        hasGross={hasGross}
        onChange={(key, value) => setBreakdown((current) => ({ ...current, [key]: value }))}
      />
      {hasGross && !totalMatches && (
        <p className="-mt-2 text-xs text-destructive" role="alert">
          The breakdown adds up to {rupees.format(total)} a month, but the new monthly gross is{" "}
          {rupees.format(Number(newGross))}.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid content-start gap-1.5">
          <Label htmlFor={readOnly ? undefined : "discussion-effective-date"}>Effective date</Label>
          {readOnly ? (
            <p className="text-sm">{formatDay(effectiveDate)}</p>
          ) : (
            <DatePicker
              id="discussion-effective-date"
              value={effectiveDate}
              onChange={changeEffectiveDate}
              disabled={busy}
              placeholder="Pick the date"
            />
          )}
        </div>
        <div className="grid content-start gap-1.5">
          <div className="flex items-center gap-1">
            <Label htmlFor={readOnly ? undefined : "discussion-next-appraisal"}>Next appraisal</Label>
            {!readOnly && (
              <InfoTip label="Next appraisal">
                A year after the effective date unless you pick another. The letter prints its month and year.
              </InfoTip>
            )}
          </div>
          {readOnly ? (
            <p className="text-sm">{formatDay(nextAppraisal)}</p>
          ) : (
            <DatePicker
              id="discussion-next-appraisal"
              value={nextAppraisal}
              onChange={setNextAppraisal}
              min={effectiveDate || undefined}
              disabled={busy}
              placeholder="Pick the date"
              aria-invalid={!datesOk}
            />
          )}
          {!datesOk && <p className="text-xs text-destructive">Must be after the effective date</p>}
        </div>
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
              disabled={busy}
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
              disabled={busy}
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
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why the promotion"
            />
          </div>
        </div>
      )}

      {!readOnly && (
        <Button
          className="w-fit"
          disabled={!incrementOk || !moneyOk || !totalMatches || !datesOk || !promotionOk || save.isPending}
          onClick={() =>
            save.mutate({
              currentCompensation: currentGross,
              incrementPercentage: increment,
              approvedCompensation: newGross,
              breakdown: Object.fromEntries(
                BREAKDOWN_ROWS.map((row) => [row.key, Number(breakdown[row.key] || 0)])
              ) as Record<BreakdownKey, number>,
              effectiveDate,
              nextAppraisalOn: nextAppraisal,
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

/**
 * The letter's COMPENSATION AND BENEFITS STRUCTURE: monthly amounts (typed),
 * the annual column (× 12, read-only) and the monthly gross they add up to.
 */
function BreakdownTable({
  breakdown,
  readOnly,
  disabled,
  hasGross,
  onChange,
}: {
  breakdown: BreakdownValues
  readOnly: boolean
  disabled: boolean
  hasGross: boolean
  onChange: (key: BreakdownKey, value: string) => void
}) {
  const total = monthlyGross(breakdown)
  const ctc = annualCtc(breakdown)
  const amount = (value: string | number) => (value === "" ? "—" : inrNumber.format(Number(value)))

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-1">
        <p className="text-sm font-medium">Compensation and benefits structure</p>
        {!readOnly && (
          <InfoTip label="Compensation and benefits structure">
            Filled from the salary rules in All Settings whenever the new monthly gross changes. Any row can be
            edited; the earnings rows must add up to the new monthly gross. The E.P.F. rows are not part of it.
          </InfoTip>
        )}
      </div>
      <div className="overflow-hidden overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Component</TableHead>
              <TableHead className="w-44 text-right">Monthly (INR)</TableHead>
              <TableHead className="w-36 text-right">Annual (INR)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {BREAKDOWN_ROWS.map((row) => {
              const value = breakdown[row.key]
              return (
                <TableRow key={row.key}>
                  <TableCell className={cn(!row.earning && "text-muted-foreground")}>
                    <label htmlFor={readOnly ? undefined : `breakdown-${row.key}`}>{row.label}</label>
                  </TableCell>
                  <TableCell className="py-1.5 text-right tabular-nums">
                    {readOnly ? (
                      amount(value)
                    ) : (
                      <Input
                        id={`breakdown-${row.key}`}
                        inputMode="decimal"
                        placeholder="0"
                        value={value}
                        disabled={disabled || !hasGross}
                        onChange={(event) => onChange(row.key, event.target.value.replace(/[^\d.]/g, ""))}
                        aria-invalid={!isMoney(value)}
                        className="h-8 text-right tabular-nums"
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {value === "" || !isMoney(value) ? "—" : amount(roundPaise(Number(value) * 12))}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-semibold">Monthly Gross</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {hasGross || readOnly ? inrNumber.format(total) : "—"}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {hasGross || readOnly ? inrNumber.format(roundPaise(total * 12)) : "—"}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      {hasGross || readOnly ? (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          Annual CTC <span className="font-medium text-foreground tabular-nums">{rupees.format(ctc)}</span>
          <InfoTip label="Annual CTC">(Monthly gross + E.P.F. Employer) × 12 — the figure the letter states.</InfoTip>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Enter the new monthly gross to fill in the table.</p>
      )}
    </div>
  )
}

/**
 * A rupee amount: a plain numeric input while editable, and the formatted
 * figure (₹, Indian digit grouping) once the decision is read-only.
 */
function MoneyField({
  id,
  label,
  value,
  readOnly,
  disabled,
  tip,
  onChange,
}: {
  id: string
  label: string
  value: string
  readOnly: boolean
  disabled: boolean
  /** Explains where the figure came from, behind an info icon by the label. */
  tip?: string
  onChange: (value: string) => void
}) {
  return (
    <div className="grid content-start gap-1.5">
      <div className="flex items-center gap-1">
        <Label htmlFor={readOnly ? undefined : id}>{label}</Label>
        {tip && !readOnly && <InfoTip label={label}>{tip}</InfoTip>}
      </div>
      {readOnly ? (
        <p className="text-sm tabular-nums">{value === "" ? "—" : rupees.format(Number(value))}</p>
      ) : (
        <Input
          id={id}
          inputMode="decimal"
          placeholder="0"
          value={value}
          disabled={disabled}
          // Digits and a decimal point only — which also keeps it non-negative
          // and lets a pasted "12,00,000" through as 1200000.
          onChange={(event) => onChange(event.target.value.replace(/[^\d.]/g, ""))}
          aria-invalid={!isMoney(value)}
        />
      )}
    </div>
  )
}

/** Blank, or a non-negative number. */
function isMoney(value: string) {
  return value === "" || (Number.isFinite(Number(value)) && Number(value) >= 0)
}

/** Decimals arrive as "80000.0"; the input shows them as typed numbers do. */
function fromServer(value: string | null) {
  return value == null ? "" : String(Number(value))
}

/** current × (1 + increment / 100), to the rupee — or null if either is missing. */
function grossAfterIncrement(gross: string, percent: string) {
  if (gross === "" || percent === "" || !isMoney(gross) || !Number.isFinite(Number(percent))) return null
  return String(Math.round((Number(gross) * (100 + Number(percent))) / 100))
}

/** The same day a year on — 29 Feb lands on 28 Feb. Local time, as the DatePicker works in. */
function plusOneYear(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  const date = new Date(y + 1, m - 1, d)
  if (date.getMonth() !== m - 1) date.setDate(0)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatDay(iso: string) {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
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

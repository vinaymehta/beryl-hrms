"use client"

import { useState } from "react"
import { ShieldIcon, PencilIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSaveCompensation } from "@/features/appraisals/hooks/use-appraisal-mutations"
import type { AppraisalDetail } from "@/types/appraisals"

const PROMOTION_OPTIONS = [
  { value: "none", label: "No promotion considered" },
  { value: "recommended", label: "Recommended" },
  { value: "not_recommended", label: "Not recommended" },
  { value: "deferred", label: "Deferred" },
]

const PROMOTION_CLASSES: Record<string, string> = {
  none: "bg-muted text-muted-foreground",
  recommended: "bg-success/15 text-success",
  not_recommended: "bg-muted text-muted-foreground",
  deferred: "bg-warning/15 text-warning",
}

function money(value: string | null) {
  if (value == null) return "—"
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function percent(value: string | null) {
  return value == null ? "—" : `${Number(value)}%`
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}

/**
 * §17 Compensation & Increment and §18 Promotion / Role Change.
 *
 * Rendered only when the server sent a `compensation` block at all, which it
 * does solely for a holder of appraisals.manage_compensation — so this
 * component is never the thing keeping restricted pay data off a screen.
 *
 * Increment and promotion are laid out as two separate decisions, because they
 * are two separate decisions.
 */
export function CompensationPanel({ appraisal }: { appraisal: AppraisalDetail }) {
  const decision = appraisal.compensation
  const [editing, setEditing] = useState(false)
  const save = useSaveCompensation(appraisal.id)

  const [form, setForm] = useState(() => ({
    currentCompensation: decision?.currentCompensation ?? "",
    lastIncrementPercentage: decision?.lastIncrementPercentage ?? "",
    lastIncrementOn: decision?.lastIncrementOn ?? "",
    recommendedIncrementPercentage: decision?.recommendedIncrementPercentage ?? "",
    recommendedCompensation: decision?.recommendedCompensation ?? "",
    approvedIncrementPercentage: decision?.approvedIncrementPercentage ?? "",
    approvedCompensation: decision?.approvedCompensation ?? "",
    effectiveDate: decision?.effectiveDate ?? "",
    managementComments: decision?.managementComments ?? "",
    promotionRecommendation: decision?.promotionRecommendation ?? "none",
    proposedDesignationId: decision?.proposedDesignationId ?? "",
    promotionReason: decision?.promotionReason ?? "",
    promotionEffectiveDate: decision?.promotionEffectiveDate ?? "",
    newResponsibilities: decision?.newResponsibilities ?? "",
  }))

  function field(key: keyof typeof form, label: string, type = "text") {
    return (
      <div className="grid gap-1.5">
        <Label htmlFor={`comp-${key}`}>{label}</Label>
        <Input
          id={`comp-${key}`}
          type={type}
          value={form[key]}
          onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
        />
      </div>
    )
  }

  if (!editing) {
    return (
      <div className="grid gap-3">
        {!decision?.anyDecision ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            No increment or promotion recorded yet.
          </p>
        ) : (
          <>
            <div className="grid gap-3">
              <p className="text-xs font-semibold text-muted-foreground">Increment</p>
              <div className="grid grid-cols-2 gap-3">
                <Row label="Current" value={money(decision.currentCompensation)} />
                <Row label="Last increment" value={percent(decision.lastIncrementPercentage)} />
                <Row label="Recommended" value={percent(decision.recommendedIncrementPercentage)} />
                <Row label="Approved" value={percent(decision.approvedIncrementPercentage)} />
                <Row label="Revised compensation" value={money(decision.approvedCompensation)} />
                <Row
                  label="Effective"
                  value={decision.effectiveDate ? new Date(decision.effectiveDate).toLocaleDateString() : "—"}
                />
              </div>
            </div>

            <div className="grid gap-3 border-t pt-3">
              <p className="text-xs font-semibold text-muted-foreground">Promotion</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={PROMOTION_CLASSES[decision.promotionRecommendation]}>
                  {PROMOTION_OPTIONS.find((o) => o.value === decision.promotionRecommendation)?.label}
                </Badge>
                {decision.proposedDesignationTitle && (
                  <span className="text-sm">
                    {decision.currentDesignationTitle ?? "—"} → {decision.proposedDesignationTitle}
                  </span>
                )}
              </div>
              {decision.promotionReason && <p className="text-sm">{decision.promotionReason}</p>}
              {decision.newResponsibilities && (
                <Row label="New responsibilities" value={decision.newResponsibilities} />
              )}
            </div>

            {decision.managementComments && (
              <div className="border-t pt-3">
                <Row label="Management comments" value={decision.managementComments} />
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Last updated by {decision.updatedBy ?? "—"} on{" "}
              {new Date(decision.updatedAt).toLocaleDateString()}
            </p>
          </>
        )}

        {appraisal.viewer.canManageCompensation && (
          <Button variant="outline" size="sm" className="w-fit gap-1.5" onClick={() => setEditing(true)}>
            <PencilIcon className="size-3.5" /> {decision?.anyDecision ? "Edit" : "Record decision"}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <ShieldIcon className="size-3.5" /> Increment — restricted
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("currentCompensation", "Current compensation", "number")}
          {field("lastIncrementPercentage", "Last increment %", "number")}
          {field("lastIncrementOn", "Last increment on", "date")}
          {field("recommendedIncrementPercentage", "Recommended increment %", "number")}
          {field("recommendedCompensation", "Recommended compensation", "number")}
          {field("approvedIncrementPercentage", "Approved increment %", "number")}
          {field("approvedCompensation", "Approved compensation", "number")}
          {field("effectiveDate", "Effective date", "date")}
        </div>
      </div>

      <div className="grid gap-3 border-t pt-3">
        <p className="text-xs font-semibold text-muted-foreground">Promotion — a separate decision</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="comp-promotion">Recommendation</Label>
            <Select
              items={PROMOTION_OPTIONS}
              value={form.promotionRecommendation}
              onValueChange={(next) =>
                setForm((prev) => ({ ...prev, promotionRecommendation: next ?? "none" }))
              }
            >
              <SelectTrigger id="comp-promotion" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROMOTION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="comp-designation">Proposed designation</Label>
            <Select
              items={appraisal.designationOptions.map((d) => ({ value: String(d.id), label: d.title }))}
              value={form.proposedDesignationId || null}
              onValueChange={(next) => setForm((prev) => ({ ...prev, proposedDesignationId: next ?? "" }))}
            >
              <SelectTrigger id="comp-designation" className="h-9 w-full">
                <SelectValue placeholder="Select a designation" />
              </SelectTrigger>
              <SelectContent>
                {appraisal.designationOptions.map((designation) => (
                  <SelectItem key={designation.id} value={String(designation.id)}>
                    {designation.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {field("promotionEffectiveDate", "Promotion effective date", "date")}
        </div>
        {field("promotionReason", "Reason")}
        {field("newResponsibilities", "New responsibilities")}
      </div>

      <div className="grid gap-1.5 border-t pt-3">
        <Label htmlFor="comp-management-comments">Management comments</Label>
        <textarea
          id="comp-management-comments"
          rows={2}
          value={form.managementComments}
          onChange={(event) => setForm((prev) => ({ ...prev, managementComments: event.target.value }))}
          className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="bg-role-hr text-role-hr-foreground hover:bg-role-hr/90"
          disabled={save.isPending}
          onClick={() => save.mutate(form, { onSuccess: () => setEditing(false) })}
        >
          {save.isPending ? "Saving…" : "Save decision"}
        </Button>
      </div>
    </div>
  )
}

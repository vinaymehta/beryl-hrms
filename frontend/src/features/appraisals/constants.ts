import type { AppraisalStatus, AppraisalStage, AppraisalLens, CycleStatus } from "@/types/appraisals"

/**
 * The workflow, in order, with the labels and colours every screen reads. One
 * list so the stepper, the badges and the filters can never disagree.
 * Mirrors the backend enum Appraisal#status.
 *
 * Classes are complete literal strings — Tailwind's scanner can't see a class
 * assembled at runtime, the same constraint the role and level badges work under.
 */
export const APPRAISAL_STATUSES: {
  value: AppraisalStatus
  label: string
  className: string
  /** Whose move it is at this point — shown next to the status badge. */
  owner: "employee" | "manager" | "admin" | "primary" | "secondary" | "final" | "hr" | null
}[] = [
  { value: "draft", label: "Draft", className: "bg-muted text-muted-foreground", owner: "hr" },
  { value: "self_appraisal_open", label: "Self-appraisal open", className: "bg-info/15 text-info", owner: "employee" },
  { value: "employee_submitted", label: "Submitted", className: "bg-info/15 text-info", owner: "primary" },
  // One entry, drawn once per manager level — see appraisalStatusLabel.
  { value: "manager_review", label: "Manager review", className: "bg-role-hr/15 text-role-hr", owner: "manager" },
  // The old fixed manager stages. Nothing enters them now; kept so any
  // historical row still has a label.
  { value: "primary_review", label: "Primary review", className: "bg-role-hr/15 text-role-hr", owner: "primary" },
  { value: "secondary_review", label: "Secondary review", className: "bg-role-hr/15 text-role-hr", owner: "secondary" },
  // Admin/HR's, after every manager level.
  { value: "final_review", label: "Final review", className: "bg-role-admin/15 text-role-admin", owner: "admin" },
  { value: "appraisal_discussion", label: "Discussion", className: "bg-warning/15 text-warning", owner: "admin" },
  { value: "compensation_approval", label: "Compensation approval", className: "bg-warning/15 text-warning", owner: "hr" },
  { value: "released", label: "Released", className: "bg-success/15 text-success", owner: "employee" },
  { value: "employee_acknowledged", label: "Acknowledged", className: "bg-success/15 text-success", owner: "hr" },
  { value: "closed", label: "Closed", className: "bg-muted text-muted-foreground", owner: null },
]

export const APPRAISAL_STATUS_LABELS = Object.fromEntries(
  APPRAISAL_STATUSES.map((s) => [s.value, s.label])
) as Record<AppraisalStatus, string>

export function appraisalStatusMeta(status: AppraisalStatus) {
  return APPRAISAL_STATUSES.find((s) => s.value === status) ?? APPRAISAL_STATUSES[0]
}

/** "Level 2 manager review" rather than a bare "Manager review", when the level is known. */
export function appraisalStatusLabel(status: AppraisalStatus, reviewLevel?: number | null) {
  if (status === "manager_review" && reviewLevel) return `Level ${reviewLevel} manager review`
  return appraisalStatusMeta(status).label
}

/** Employee → each manager level → Final (Admin/HR). */
export const APPRAISAL_STAGES: { value: AppraisalStage; label: string; shortLabel: string; className: string }[] = [
  { value: "self_appraisal", label: "Employee self-appraisal", shortLabel: "Self", className: "bg-info/15 text-info" },
  { value: "manager_review", label: "Manager review", shortLabel: "Manager", className: "bg-role-hr/15 text-role-hr" },
  { value: "primary_review", label: "Primary manager review", shortLabel: "Primary", className: "bg-role-hr/15 text-role-hr" },
  { value: "secondary_review", label: "Secondary manager review", shortLabel: "Secondary", className: "bg-muted text-muted-foreground" },
  { value: "final_review", label: "Final review (Admin/HR)", shortLabel: "Final", className: "bg-role-admin/15 text-role-admin" },
]

/** A stage's labels, with the manager level spelled out when there is one. */
export function appraisalStageMeta(stage: AppraisalStage, reviewLevel?: number | null) {
  const meta = APPRAISAL_STAGES.find((s) => s.value === stage) ?? APPRAISAL_STAGES[0]
  if (stage !== "manager_review" || !reviewLevel) return meta
  return { ...meta, label: `Level ${reviewLevel} manager review`, shortLabel: `Level ${reviewLevel}` }
}

/** The scope's headline split, shown as guidance when weighting a template. */
export const APPRAISAL_LENSES: { value: AppraisalLens; label: string; targetWeight: number; className: string }[] = [
  { value: "past", label: "Past performance", targetWeight: 60, className: "bg-role-hr/15 text-role-hr" },
  { value: "current_capability", label: "Current capability", targetWeight: 25, className: "bg-info/15 text-info" },
  { value: "future_readiness", label: "Future readiness", targetWeight: 15, className: "bg-role-admin/15 text-role-admin" },
]

export function appraisalLensMeta(lens: AppraisalLens) {
  return APPRAISAL_LENSES.find((l) => l.value === lens) ?? APPRAISAL_LENSES[0]
}

export const CYCLE_STATUSES: { value: CycleStatus; label: string; className: string }[] = [
  { value: "draft", label: "Draft", className: "bg-muted text-muted-foreground" },
  { value: "active", label: "Active", className: "bg-success/15 text-success" },
  { value: "closed", label: "Closed", className: "bg-info/15 text-info" },
  { value: "cancelled", label: "Cancelled", className: "bg-destructive/15 text-destructive" },
]

/**
 * The scope's rating scale (§6), wording and descriptions verbatim. Every
 * rating requires evidence — enforced by the backend (AppraisalAnswer) and
 * mirrored here so the requirement shows before submitting rather than after.
 *
 * These are the scale's LEVELS, whole numbers 1–5. An answer can also sit
 * halfway between two of them (3.5) — see RATING_STEP.
 *
 * The scope also asks for configurable scales; this is the current fixed model,
 * and the shape below is what a configurable one would replace.
 */
export const RATING_SCALE = [
  {
    value: 1,
    label: "Unsatisfactory",
    description: "Significant gaps remain despite feedback and reasonable support.",
    requiresComment: true,
  },
  {
    value: 2,
    label: "Needs Improvement",
    description: "Inconsistent, or needs more support/supervision than expected.",
    requiresComment: true,
  },
  {
    value: 3,
    label: "Meets Expectations",
    description: "Reliable performance appropriate for role and agreed responsibilities.",
    requiresComment: true,
  },
  {
    value: 4,
    label: "Strong",
    description: "Frequently exceeds expectations; works effectively with limited supervision.",
    requiresComment: true,
  },
  {
    value: 5,
    label: "Exceptional",
    description: "Consistently beyond role expectations, with significant demonstrable impact.",
    requiresComment: true,
  },
]

/** One point on a rating scale. */
export interface RatingScaleOption {
  value: number
  label: string
  description: string
  requiresComment: boolean
}

/**
 * The rating scale an appraisal actually uses: its TEMPLATE's rating guide
 * when the template has one, the built-in scale otherwise.
 *
 * The guide's levels are whole numbers 1–5 (answers may fall halfway between
 * two of them, never outside), so guide rows outside that range are left out
 * rather than offered and then refused. The evidence rule stays the server's:
 * every rating needs a comment.
 */
export function ratingScaleFrom(guide?: { rating: number | null; level: string | null; definition: string | null }[] | null): RatingScaleOption[] {
  const rows = (guide ?? [])
    .filter((row) => row.rating != null && Number.isInteger(row.rating) && row.rating >= 1 && row.rating <= 5)
    .map((row) => ({
      value: row.rating!,
      label: row.level?.trim() || `Rating ${row.rating}`,
      description: row.definition ?? "",
      requiresComment: ratingRequiresComment(row.rating),
    }))
  const unique = [...new Map(rows.map((row) => [row.value, row])).values()]
  return unique.length ? unique.sort((a, b) => a.value - b.value) : RATING_SCALE
}

/**
 * A self-rating this far above the reviewer's own is worth pointing at during
 * calibration (scope §12: "significant rating gaps should be visually
 * highlighted"). Two points on a five-point scale is a real disagreement, not
 * rounding.
 */
export const SIGNIFICANT_RATING_GAP = 2

/**
 * Half-star ratings: an answer runs 1 to 5 in steps of 0.5 (AppraisalAnswer),
 * so 3.5 is three full stars and a half. The minimum is a whole 1 — there is
 * no half-star-only rating.
 */
export const RATING_STEP = 0.5

/** Mirrors the backend rule (AppraisalAnswer): every rating, whole or half, needs evidence. */
export function ratingRequiresComment(rating: number | null | undefined) {
  return rating != null
}

/**
 * A rating or an average of ratings for display: at most one decimal, and no
 * trailing ".0" — `4`, `3.5`, and an average of 3.25 as `3.3`.
 */
export function formatRating(rating: number | null | undefined, empty = "—") {
  if (rating == null || !Number.isFinite(rating)) return empty
  return String(Math.round(rating * 10) / 10)
}

/**
 * The scale level a rating falls on: its own for a whole rating, the level
 * BELOW it for a half (3.5 reads as "Meets Expectations", half a star on).
 */
export function ratingLevel<T extends { value: number }>(scale: T[], rating: number | null | undefined): T | null {
  if (rating == null) return null
  return scale.filter((option) => option.value <= rating).at(-1) ?? null
}

/** The free-text blocks a revision carries, in the order the form shows them. */
export const NARRATIVE_FIELDS: { key: NarrativeKey; label: string; placeholder: string }[] = [
  { key: "summary", label: "Overall summary", placeholder: "How would you sum up the period?" },
  { key: "achievements", label: "Key achievements", placeholder: "What did you deliver?" },
  { key: "strengths", label: "Strengths", placeholder: "What are you strongest at?" },
  { key: "improvementAreas", label: "Areas to improve", placeholder: "Where do you want to get better?" },
  { key: "trainingNeeds", label: "Skills / training needs", placeholder: "What support would help?" },
  { key: "nextPeriodGoals", label: "Goals for the next period", placeholder: "What are you taking on next?" },
]

export type NarrativeKey =
  | "summary"
  | "achievements"
  | "strengths"
  | "improvementAreas"
  | "trainingNeeds"
  | "nextPeriodGoals"

/** The six fixed narrative fields, which a revision keeps in their own columns. */
export const isNarrativeKey = (key: string): key is NarrativeKey =>
  NARRATIVE_FIELDS.some((field) => field.key === key)

/** §22 review types. One attribute on the cycle, not a second workflow. */
export const REVIEW_TYPES = [
  { value: "annual", label: "Annual appraisal" },
  { value: "mid_year", label: "Mid-year review" },
  { value: "probation", label: "Probation review" },
  { value: "performance_improvement", label: "Performance improvement review" },
  { value: "promotion", label: "Promotion review" },
  { value: "ad_hoc", label: "Ad-hoc review" },
]

/**
 * Who answers a template field. The Final Review block mixes both: a field
 * whose label names the employee ("Employee Final Comments") is theirs, the
 * rest every manager level answers. An explicit `audience` on the field wins;
 * templates imported before fields carried one are read by label.
 */
export function templateFieldAudience(
  sectionKey: string,
  field: { label: string; audience?: "reviewer" | "employee" | null },
  sectionAudience?: "reviewer" | "employee" | null
): "reviewer" | "employee" | "both" {
  if (field.audience) return field.audience
  if (sectionKey === "final_review") return /\bemployee\b/i.test(field.label) ? "employee" : "reviewer"
  return sectionAudience === "reviewer" ? "reviewer" : "both"
}

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
  owner: "employee" | "primary" | "secondary" | "final" | "hr" | null
}[] = [
  { value: "draft", label: "Draft", className: "bg-muted text-muted-foreground", owner: "hr" },
  { value: "self_appraisal_open", label: "Self-appraisal open", className: "bg-info/15 text-info", owner: "employee" },
  { value: "employee_submitted", label: "Submitted", className: "bg-info/15 text-info", owner: "primary" },
  { value: "primary_review", label: "Primary review", className: "bg-role-hr/15 text-role-hr", owner: "primary" },
  { value: "secondary_review", label: "Secondary review", className: "bg-role-hr/15 text-role-hr", owner: "secondary" },
  { value: "final_review", label: "Final review", className: "bg-role-admin/15 text-role-admin", owner: "final" },
  { value: "appraisal_discussion", label: "Discussion", className: "bg-warning/15 text-warning", owner: "final" },
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

/** Employee → V1 → Primary → V2 → Secondary → V3 → Final. */
export const APPRAISAL_STAGES: { value: AppraisalStage; label: string; shortLabel: string; className: string }[] = [
  { value: "self_appraisal", label: "Employee self-appraisal", shortLabel: "Self", className: "bg-info/15 text-info" },
  { value: "primary_review", label: "Primary manager review", shortLabel: "Primary", className: "bg-role-hr/15 text-role-hr" },
  { value: "secondary_review", label: "Secondary manager review", shortLabel: "Secondary", className: "bg-muted text-muted-foreground" },
  { value: "final_review", label: "Final review / calibration", shortLabel: "Final", className: "bg-role-admin/15 text-role-admin" },
]

export function appraisalStageMeta(stage: AppraisalStage) {
  return APPRAISAL_STAGES.find((s) => s.value === stage) ?? APPRAISAL_STAGES[0]
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
 * The scope's rating scale (§6), wording and descriptions verbatim. Ratings 1,
 * 2, 4 and 5 require evidence — enforced by the backend (AppraisalAnswer) and
 * mirrored here so the requirement shows before submitting rather than after.
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
    requiresComment: false,
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

/**
 * A self-rating this far above the reviewer's own is worth pointing at during
 * calibration (scope §12: "significant rating gaps should be visually
 * highlighted"). Two points on a five-point scale is a real disagreement, not
 * rounding.
 */
export const SIGNIFICANT_RATING_GAP = 2

export const RATINGS_REQUIRING_COMMENT = [1, 2, 4, 5]

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

/** §22 review types. One attribute on the cycle, not a second workflow. */
export const REVIEW_TYPES = [
  { value: "annual", label: "Annual appraisal" },
  { value: "mid_year", label: "Mid-year review" },
  { value: "probation", label: "Probation review" },
  { value: "performance_improvement", label: "Performance improvement review" },
  { value: "promotion", label: "Promotion review" },
  { value: "ad_hoc", label: "Ad-hoc review" },
]

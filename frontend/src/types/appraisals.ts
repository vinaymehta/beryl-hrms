import type { EmployeeSummary } from "@/types/employees"

/** The scope's workflow, in order. Mirrors the backend enum Appraisal#status. */
export type AppraisalStatus =
  | "draft"
  | "self_appraisal_open"
  | "employee_submitted"
  | "primary_review"
  | "secondary_review"
  | "final_review"
  | "appraisal_discussion"
  | "compensation_approval"
  | "released"
  | "employee_acknowledged"
  | "closed"

/** Which party authored a revision. V1 self → V2 primary → V3 secondary → Final. */
export type AppraisalStage = "self_appraisal" | "primary_review" | "secondary_review" | "final_review"

/** The three performance lenses (Past 60 / Current 25 / Future 15). */
export type AppraisalLens = "past" | "current_capability" | "future_readiness"

export type CommentVisibility = "employee_visible" | "management_only"

export type CycleStatus = "draft" | "active" | "closed" | "cancelled"

export type TemplateStatus = "draft" | "active" | "archived"

export interface AppraisalTemplateQuestion {
  id: string
  prompt: string
  description: string | null
  position: number
  selfRating: boolean
  managerRating: boolean
  requiresComment: boolean
  required: boolean
}

export interface AppraisalTemplateCategory {
  id: string
  name: string
  description: string | null
  lens: AppraisalLens
  weight: string | number
  position: number
  questions: AppraisalTemplateQuestion[]
}

export interface AppraisalTemplate {
  id: string
  name: string
  description: string | null
  status: TemplateStatus
  version: number
  lineageId: string | null
  /** True once a cycle has started against it — edit becomes "new version". */
  inUse: boolean
  totalWeight: number
  categories: AppraisalTemplateCategory[]
  createdAt: string
}

export interface AppraisalCycle {
  id: string
  name: string
  description: string | null
  status: CycleStatus
  assessmentPeriodStart: string | null
  assessmentPeriodEnd: string | null
  startsOn: string | null
  employeeSubmissionDeadline: string | null
  primaryReviewDeadline: string | null
  secondaryReviewDeadline: string | null
  finalizationDeadline: string | null
  compensationEffectiveDate: string | null
  secondaryReviewEnabled: boolean
  reviewType: string
  appraisalTemplateId: string
  templateName: string | null
  templateVersion: number | null
  started: boolean
  startedAt: string | null
  closedAt: string | null
  eligibleCount: number
  appraisalCount: number
  statusCounts: Partial<Record<AppraisalStatus, number>>
  createdAt: string
}

export interface AppraisalCycleDetail extends AppraisalCycle {
  eligibleEmployees: EmployeeSummary[]
  /** Only present on the response to starting a cycle. */
  createdCount?: number
  skipped?: { employeeId: string; name: string; reason: string }[]
}

export interface AppraisalSummary {
  id: string
  status: AppraisalStatus
  appraisalCycleId: string
  employeeId: string
  cycleName: string | null
  employeeName: string | null
  employeeCode: string | null
  calculatedScore: string | null
  finalScore: string | null
  effectiveScore: string | null
  releasedAt: string | null
  acknowledgedAt: string | null
  secondaryReviewApplicable: boolean
  primaryManagerName: string | null
  finalManagerName: string | null
  currentVersion: number | null
}

export interface AppraisalAnswer {
  id: string
  appraisalTemplateQuestionId: string
  rating: number | null
  comment: string | null
}

/** One immutable version. Which ones arrive is decided server-side. */
export interface AppraisalRevision {
  id: string
  versionNumber: number
  label: string
  stage: AppraisalStage
  submittedAt: string
  calculatedScore: string | null
  authorName: string | null
  summary: string | null
  achievements: string | null
  strengths: string | null
  improvementAreas: string | null
  trainingNeeds: string | null
  nextPeriodGoals: string | null
  answers: AppraisalAnswer[]
}

export interface AppraisalComment {
  id: string
  body: string
  visibility: CommentVisibility
  appraisalRevisionId: string | null
  authorName: string | null
  createdAt: string
}

export interface AppraisalTransition {
  id: string
  fromStatus: AppraisalStatus | null
  toStatus: AppraisalStatus
  actorName: string | null
  notes: string | null
  createdAt: string
}

export interface AppraisalScoreOverride {
  id: string
  previousScore: string | null
  newScore: string
  reason: string
  actorName: string | null
  createdAt: string
}

/**
 * §17 + §18. Increment and promotion are independent — there is deliberately
 * no single "decision" field forcing them to move together — and what was
 * RECOMMENDED is kept apart from what was APPROVED.
 */
export interface AppraisalCompensationDecision {
  id: string
  currentCompensation: string | null
  lastIncrementPercentage: string | null
  lastIncrementOn: string | null
  recommendedIncrementPercentage: string | null
  recommendedCompensation: string | null
  approvedIncrementPercentage: string | null
  approvedCompensation: string | null
  effectiveDate: string | null
  managementComments: string | null
  promotionRecommendation: "none" | "recommended" | "not_recommended" | "deferred"
  currentDesignationId: string | null
  currentDesignationTitle: string | null
  proposedDesignationId: string | null
  proposedDesignationTitle: string | null
  promotionReason: string | null
  promotionEffectiveDate: string | null
  newResponsibilities: string | null
  anyDecision: boolean
  updatedBy: string | null
  updatedAt: string
}

/**
 * What THIS viewer is to this appraisal and what they may do right now.
 * Computed server-side by Appraisals::DetailPresenter so the UI never
 * re-derives an authorization rule the backend already decided.
 */
export interface AppraisalViewer {
  level: "primary" | "secondary" | "final" | null
  isSubject: boolean
  isAdministrator: boolean
  canSaveSelfDraft: boolean
  canSubmitSelf: boolean
  canSubmitReview: boolean
  canReturnForCorrection: boolean
  canAdvance: boolean
  canOverrideScore: boolean
  canRelease: boolean
  canAcknowledge: boolean
  canManageCompensation: boolean
  canSetManagementOnlyComment: boolean
  visibleRevisionStages: AppraisalStage[]
}

export interface AppraisalDetail extends AppraisalSummary {
  cycle: AppraisalCycle
  /** The cycle's FROZEN template — never the newest version. */
  template: AppraisalTemplate
  revisions: AppraisalRevision[]
  comments: AppraisalComment[]
  transitions: AppraisalTransition[]
  scoreOverrides: AppraisalScoreOverride[]
  compensation: AppraisalCompensationDecision | null
  /** Empty unless the viewer may record a promotion. */
  designationOptions: { id: string; title: string }[]
  managers: {
    primary: EmployeeSummary | null
    secondary: EmployeeSummary | null
    final: EmployeeSummary | null
  }
  viewer: AppraisalViewer
}

export interface AppraisalListParams {
  cycleId?: string
  status?: AppraisalStatus
  employeeId?: string
  scope?: "mine" | "pending"
}

export interface AppNotification {
  id: string
  category: string
  title: string
  body: string | null
  actionUrl: string | null
  readAt: string | null
  createdAt: string
}

/** One parsed spreadsheet row, as returned by the preview step. Never saved. */
export interface ImportPreviewRow {
  questionId: string
  prompt: string
  rating: number | null
  comment: string
  errors: string[]
}

export interface ImportPreview {
  rows: ImportPreviewRow[]
  validCount: number
  invalidCount: number
  totalQuestions: number
}

/** One row of the §16 calibration dashboard. */
export interface CalibrationRow {
  appraisalId: string
  employeeId: string
  employeeName: string
  employeeCode: string
  designation: string | null
  currentLevel: string | null
  status: AppraisalStatus
  selfRating: number | null
  managerRating: number | null
  weightedScore: number | null
  finalRating: number | null
  overridden: boolean
  gap: number | null
  /** Self and manager disagree by 2+ points — worth a human look, not a rule. */
  flagged: boolean
  primaryManager: string | null
  finalManager: string | null
  released: boolean
}

export interface Calibration {
  rows: CalibrationRow[]
  summary: {
    total: number
    flagged: number
    awaitingReview: number
    released: number
    distribution: Record<string, number>
  }
}

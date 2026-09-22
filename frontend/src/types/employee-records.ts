/**
 * Phase 1 (employment/compensation history, assets) and Phase 5 (goals,
 * skills, training, PIP) records, plus optional 360° feedback.
 *
 * All of these come back from the shared EmployeeSubresource concern as flat
 * camelCased rows, so one loose row type serves the generic table rather than
 * eight near-identical interfaces.
 */
export interface EmployeeRecordRow {
  id: string
  [key: string]: unknown
}

export interface AppraisalFeedbackRequestRow {
  id: string
  appraisalId: string
  requestedFromId: string
  requestedFromName: string | null
  prompt: string | null
  response: string | null
  status: "pending" | "submitted" | "declined"
  visibility: "employee_visible" | "management_only"
  respondedAt: string | null
  createdAt: string
}

/** The API path segment under /employees/:id/ for each record kind. */
export type EmployeeRecordResource =
  | "employment_events"
  | "compensation_records"
  | "assets"
  | "goals"
  | "skills"
  | "trainings"
  | "improvement_plans"

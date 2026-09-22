import {
  HistoryIcon, BanknoteIcon, LaptopIcon, TargetIcon, SparklesIcon,
  GraduationCapIcon, LifeBuoyIcon, type LucideIcon,
} from "lucide-react"

import { PERMISSIONS, type PermissionKey } from "@/constants/permissions"
import type { EmployeeRecordResource } from "@/types/employee-records"

export interface FieldSpec {
  key: string
  label: string
  type: "text" | "textarea" | "number" | "date" | "select"
  options?: { value: string; label: string }[]
  required?: boolean
}

export interface ColumnSpec {
  key: string
  label: string
  /** How to render the value. `enum` humanises an underscored enum name. */
  kind?: "text" | "label" | "date" | "enum" | "percent" | "money" | "boolean"
}

export interface RecordPanelSpec {
  resource: EmployeeRecordResource
  label: string
  icon: LucideIcon
  /** Gates the write actions, and (for restricted panels) the tab itself. */
  permission: PermissionKey
  /** True where the record is generated rather than entered — no write UI. */
  readOnly?: boolean
  /** Hide the whole tab from anyone without the permission (pay data). */
  restricted?: boolean
  columns: ColumnSpec[]
  fields: FieldSpec[]
  emptyHint: string
}

const enumOptions = (...values: string[]) =>
  values.map((value) => ({ value, label: value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) }))

/**
 * One config, seven panels. Everything about each employee record kind — its
 * API path, its permission, its columns and its form — is declared here and
 * rendered by the generic table/form pair, rather than by seven components
 * that would drift apart.
 */
export const RECORD_PANELS: RecordPanelSpec[] = [
  {
    resource: "employment_events",
    label: "History",
    icon: HistoryIcon,
    permission: PERMISSIONS.employeeHistoryView,
    // Written by Employee callbacks and immutable (§3, §26) — there is nothing
    // to add or edit by hand.
    readOnly: true,
    columns: [
      { key: "effectiveOn", label: "Date", kind: "date" },
      { key: "eventType", label: "Change", kind: "enum" },
      { key: "fromValue", label: "From", kind: "label" },
      { key: "toValue", label: "To", kind: "label" },
    ],
    fields: [],
    emptyHint: "Changes to designation, department, status, type, location and managers appear here automatically.",
  },
  {
    resource: "compensation_records",
    label: "Compensation",
    icon: BanknoteIcon,
    permission: PERMISSIONS.compensationManage,
    restricted: true,
    columns: [
      { key: "effectiveOn", label: "Effective", kind: "date" },
      { key: "annualCompensation", label: "Annual", kind: "money" },
      { key: "incrementPercentage", label: "Increment", kind: "percent" },
      { key: "reason", label: "Reason", kind: "enum" },
      { key: "note", label: "Note" },
    ],
    fields: [
      { key: "effectiveOn", label: "Effective date", type: "date", required: true },
      { key: "annualCompensation", label: "Annual compensation", type: "number" },
      { key: "incrementPercentage", label: "Increment %", type: "number" },
      {
        key: "reason", label: "Reason", type: "select",
        options: enumOptions("initial", "annual_increment", "promotion", "market_correction", "other"),
      },
      { key: "note", label: "Note", type: "textarea" },
    ],
    emptyHint: "No compensation history recorded.",
  },
  {
    resource: "assets",
    label: "Assets",
    icon: LaptopIcon,
    permission: PERMISSIONS.assetsManage,
    columns: [
      { key: "name", label: "Asset" },
      { key: "assetType", label: "Type", kind: "enum" },
      { key: "identifier", label: "Identifier" },
      { key: "status", label: "Status", kind: "enum" },
      { key: "assignedOn", label: "Assigned", kind: "date" },
      { key: "returnedOn", label: "Returned", kind: "date" },
    ],
    fields: [
      { key: "name", label: "Asset name", type: "text", required: true },
      {
        key: "assetType", label: "Type", type: "select",
        options: enumOptions("laptop", "phone", "monitor", "accessory", "access_card", "other"),
      },
      { key: "identifier", label: "Serial / tag", type: "text" },
      { key: "status", label: "Status", type: "select", options: enumOptions("assigned", "returned", "lost", "retired") },
      { key: "assignedOn", label: "Assigned on", type: "date" },
      { key: "returnedOn", label: "Returned on", type: "date" },
      { key: "note", label: "Note", type: "textarea" },
    ],
    emptyHint: "No company assets assigned.",
  },
  {
    resource: "goals",
    label: "Goals",
    icon: TargetIcon,
    permission: PERMISSIONS.goalsManage,
    columns: [
      { key: "title", label: "Goal" },
      { key: "priority", label: "Priority", kind: "enum" },
      { key: "status", label: "Status", kind: "enum" },
      { key: "targetDate", label: "Target", kind: "date" },
      { key: "successCriteria", label: "Success criteria" },
    ],
    fields: [
      { key: "title", label: "Goal", type: "text", required: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "successCriteria", label: "Success criteria", type: "textarea" },
      { key: "priority", label: "Priority", type: "select", options: enumOptions("low", "medium", "high") },
      {
        key: "status", label: "Status", type: "select",
        options: enumOptions("not_started", "in_progress", "achieved", "partially_achieved", "dropped"),
      },
      { key: "targetDate", label: "Target date", type: "date" },
      { key: "progressNote", label: "Progress update", type: "textarea" },
      { key: "managerComment", label: "Manager comment", type: "textarea" },
    ],
    emptyHint: "No goals set. Goals carry over into the next review.",
  },
  {
    resource: "skills",
    label: "Skills",
    icon: SparklesIcon,
    permission: PERMISSIONS.skillsManage,
    columns: [
      { key: "name", label: "Skill" },
      { key: "proficiency", label: "Proficiency", kind: "enum" },
      { key: "validated", label: "Validated", kind: "boolean" },
      { key: "validatedOn", label: "On", kind: "date" },
      { key: "evidence", label: "Evidence" },
    ],
    fields: [
      { key: "name", label: "Skill", type: "text", required: true },
      {
        key: "proficiency", label: "Proficiency", type: "select",
        options: enumOptions("beginner", "working", "proficient", "advanced", "expert"),
      },
      { key: "evidence", label: "Evidence", type: "textarea" },
    ],
    emptyHint: "No skills recorded in the matrix yet.",
  },
  {
    resource: "trainings",
    label: "Training",
    icon: GraduationCapIcon,
    permission: PERMISSIONS.trainingManage,
    columns: [
      { key: "name", label: "Training" },
      { key: "status", label: "Status", kind: "enum" },
      { key: "identifiedOn", label: "Identified", kind: "date" },
      { key: "completedOn", label: "Completed", kind: "date" },
    ],
    fields: [
      { key: "name", label: "Training", type: "text", required: true },
      { key: "description", label: "Description", type: "textarea" },
      {
        key: "status", label: "Status", type: "select",
        options: enumOptions("identified", "assigned", "completed", "manager_validated"),
      },
      { key: "identifiedOn", label: "Identified on", type: "date" },
      { key: "completedOn", label: "Completed on", type: "date" },
    ],
    emptyHint: "No training identified. Appraisal skill gaps can create training actions here.",
  },
  {
    resource: "improvement_plans",
    label: "PIP",
    icon: LifeBuoyIcon,
    permission: PERMISSIONS.pipManage,
    columns: [
      { key: "status", label: "Status", kind: "enum" },
      { key: "issueDescription", label: "Issue" },
      { key: "startsOn", label: "Starts", kind: "date" },
      { key: "reviewOn", label: "Review", kind: "date" },
      { key: "closedOn", label: "Closed", kind: "date" },
    ],
    fields: [
      { key: "issueDescription", label: "Issue", type: "textarea", required: true },
      { key: "expectedImprovement", label: "Expected improvement", type: "textarea" },
      { key: "measurableTargets", label: "Measurable targets", type: "textarea" },
      { key: "supportProvided", label: "Support / training", type: "textarea" },
      {
        key: "status", label: "Status", type: "select",
        options: enumOptions("draft", "active", "review", "successfully_completed", "extended", "closed"),
      },
      { key: "startsOn", label: "Starts on", type: "date" },
      { key: "reviewOn", label: "Review on", type: "date" },
      { key: "closedOn", label: "Closed on", type: "date" },
      { key: "employeeComments", label: "Employee comments", type: "textarea" },
      { key: "outcomeNote", label: "Outcome", type: "textarea" },
    ],
    emptyHint: "No improvement plan. A PIP runs separately from the appraisal workflow.",
  },
]

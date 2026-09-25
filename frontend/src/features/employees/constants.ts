import type { EmployeeLevel, ManagerLevel, ReviewChainLevel } from "@/types/employees"

/**
 * The career ladder, in ladder order (not alphabetical) — every select, badge
 * and filter in the module reads this one list so they can never drift apart.
 * Mirrors the backend enum Employee#current_level.
 *
 * Classes are written as complete literal strings: Tailwind's scanner can't
 * see a class assembled at runtime from a token, so `bg-${x}/15` would ship
 * unstyled. Same constraint the role badges work under (constants/permissions.ts).
 */
/**
 * The career ladder, kept as the labels for the `current_level` column.
 *
 * No longer shown on the employee form, the directory or the profile — the
 * field was taken out of all three. The column and its values are untouched,
 * so anything already recorded still reads back, and the appraisal side still
 * reports a level where it has one.
 */
export const EMPLOYEE_LEVELS: {
  value: EmployeeLevel
  label: string
  /** Badge colour — cool → warm as seniority rises. */
  className: string
}[] = [
  { value: "intern", label: "Intern", className: "bg-muted text-muted-foreground" },
  { value: "junior", label: "Junior", className: "bg-role-employee/15 text-role-employee" },
  { value: "senior", label: "Senior", className: "bg-info/15 text-info" },
  { value: "lead", label: "Lead", className: "bg-role-admin/15 text-role-admin" },
  { value: "manager", label: "Manager", className: "bg-warning/15 text-warning" },
]

export const EMPLOYEE_LEVEL_LABELS: Record<EmployeeLevel, string> = Object.fromEntries(
  EMPLOYEE_LEVELS.map((level) => [level.value, level.label])
) as Record<EmployeeLevel, string>

/**
 * Male and female only, matching Employee::GENDERS on the server. Narrowed
 * from a four-option list: the server now refuses anything else, so offering
 * "Other" or "Prefer not to say" would only produce a rejected save. Rows
 * already holding one of the old values keep it — the validation is scoped to
 * the field actually changing.
 */
export const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
]

/**
 * The city list is generated, and no generated list has every place on it.
 * Picking this reveals a free-text box, and what gets typed there is what is
 * saved — the sentinel itself never reaches the API.
 */
export const OTHER_CITY = "__other__"

/**
 * Always granted to a newly provisioned employee account by the backend
 * (Employees::AccountProvisioner::DEFAULT_ROLE_SLUG). The roles picker shows it
 * as locked-on rather than hiding it, so it's clear what the person will get.
 */
export const DEFAULT_EMPLOYEE_ROLE_SLUG = "employee"

/**
 * The reporting-manager hierarchy, in hierarchy order:
 *
 *   Employee → Primary Manager → (optional) Secondary Manager → Final Manager
 *
 * Every dropdown, badge and detail row reads this one list, so the order and
 * the wording can't drift apart between screens. Mirrors the backend enum
 * EmployeeManager#manager_level.
 *
 * `required` drives the Required/Optional marker and the incomplete-hierarchy
 * warning. It is deliberately not a hard form validation: the very first
 * employee in a new company has nobody to pick yet, and blocking an unrelated
 * edit (a phone number, say) on a record predating this feature would be the
 * wrong trade. What IS hard-enforced, on both sides, is that no manager can be
 * assigned without a Primary.
 */
/**
 * The fixed three-slot review chain, labelled by reporting level.
 *
 * The labels are ordinals ("1st Level Manager") and the values are the roles
 * the appraisal workflow reads (primary/secondary/final) — the same three
 * people under two names. Only the first is mandatory; the rest are added on
 * demand, and anything past the third goes in as an `additional` tier that no
 * appraisal reads.
 */
export const MANAGER_LEVELS: {
  value: ReviewChainLevel
  label: string
  /** Who normally fills this slot — the brief's own guidance, shown inline. */
  hint: string
  required: boolean
  className: string
}[] = [
  {
    value: "primary",
    label: "1st Level Manager",
    hint: "The employee's direct reporting manager or tech lead — also their first appraisal reviewer",
    required: true,
    className: "bg-role-hr/15 text-role-hr",
  },
  {
    value: "secondary",
    label: "2nd Level Manager",
    hint: "For cross-project or shared-reporting situations — the second appraisal reviewer",
    required: false,
    className: "bg-muted text-muted-foreground",
  },
  {
    value: "final",
    label: "3rd Level Manager",
    hint: "Normally the CEO or department head — the final appraisal reviewer",
    // Optional, like every level but the first. Plenty of small companies
    // have a one-person reporting line, and a chain without a final reviewer
    // no longer counts as incomplete — see Employee#manager_hierarchy_complete?.
    required: false,
    className: "bg-role-admin/15 text-role-admin",
  },
]

/**
 * §4's two further relationships, kept apart from MANAGER_LEVELS on purpose:
 * they are NOT rungs of the review chain, and the UI must not imply they are.
 * Neither is read by the appraisal workflow.
 */
/**
 * Relationships outside the review chain.
 *
 * Department Head was removed from the Add Employee form — the column, the
 * enum value and every assignment already made are untouched, so historical
 * hierarchies still read correctly; there is simply no longer a field for it.
 */
export const ADDITIONAL_MANAGER_RELATIONSHIPS: {
  value: Extract<ManagerLevel, "project_manager">
  label: string
  hint: string
  /** True for the one slot that holds several people. */
  multiple: boolean
  className: string
}[] = [
  {
    value: "project_manager",
    label: "Project Manager(s)",
    hint: "One per project — an employee may have several at once",
    multiple: true,
    className: "bg-info/15 text-info",
  },
]

export const MANAGER_LEVEL_LABELS: Record<string, string> = Object.fromEntries(
  [...MANAGER_LEVELS, ...ADDITIONAL_MANAGER_RELATIONSHIPS].map((level) => [level.value, level.label])
)

/** §3's employment TYPE — a different axis from the lifecycle `status`. */
export const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "intern", label: "Intern" },
  { value: "consultant", label: "Consultant" },
]

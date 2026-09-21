import type { EmployeeLevel, ManagerLevel } from "@/types/employees"

/**
 * The career ladder, in ladder order (not alphabetical) — every select, badge
 * and filter in the module reads this one list so they can never drift apart.
 * Mirrors the backend enum Employee#current_level.
 *
 * Classes are written as complete literal strings: Tailwind's scanner can't
 * see a class assembled at runtime from a token, so `bg-${x}/15` would ship
 * unstyled. Same constraint the role badges work under (constants/permissions.ts).
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

export const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
]

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
export const MANAGER_LEVELS: {
  value: ManagerLevel
  label: string
  /** Who normally fills this slot — the brief's own guidance, shown inline. */
  hint: string
  required: boolean
  className: string
}[] = [
  {
    value: "primary",
    label: "Primary Manager",
    hint: "The employee's direct reporting manager or tech lead",
    required: true,
    className: "bg-role-hr/15 text-role-hr",
  },
  {
    value: "secondary",
    label: "Secondary Manager",
    hint: "For cross-project or shared-reporting situations",
    required: false,
    className: "bg-muted text-muted-foreground",
  },
  {
    value: "final",
    label: "Final Manager",
    hint: "Normally the CEO or department head",
    required: true,
    className: "bg-role-admin/15 text-role-admin",
  },
]

export const MANAGER_LEVEL_LABELS: Record<ManagerLevel, string> = Object.fromEntries(
  MANAGER_LEVELS.map((level) => [level.value, level.label])
) as Record<ManagerLevel, string>

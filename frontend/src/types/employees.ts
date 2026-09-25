import type { Role } from "@/types/auth"

export type EmployeeStatus = "active" | "inactive" | "offboarded"

/**
 * The HR career ladder (backend `employees.current_level`). Deliberately NOT
 * the same thing as an RBAC `Role` — a Senior engineer and an HR Lead can both
 * carry only the Employee role, and an Admin can be an Intern. See
 * EMPLOYEE_LEVELS in features/employees/constants.ts for labels.
 */
export type EmployeeLevel = "intern" | "junior" | "senior" | "lead" | "manager"

export interface Department {
  id: string
  name: string
  description: string | null
  /**
   * Always "active" in anything the API returns: the list excludes archived
   * rows, because deleting archives and a deleted department should not be
   * offered anywhere. Kept on the type because the column is real.
   */
  status: "active" | "archived"
  /** How many people are in it — what a delete would leave without one. */
  employeeCount: number
  designationCount: number
}

export interface Designation {
  id: string
  title: string
  departmentId: string | null
  status: "active" | "archived"
}

/**
 * The compact shape an employee takes when nested inside another employee —
 * today, as one of their reporting managers. The backend serves this from
 * EmployeeSummarySerializer and deliberately omits personal details, so a
 * reporting line never exposes a colleague's address or date of birth.
 */
export interface EmployeeSummary {
  id: string
  fullName: string
  employeeCode: string
  status: EmployeeStatus
  currentLevel: EmployeeLevel | null
  designationTitle: string | null
  departmentName: string | null
  profilePhotoUrl: string | null
}

/** The login account behind an employee record. Null when they have none. */
/**
 * What comes back from sending an employee their sign-in details.
 *
 * The password IS returned, once, so the administrator who pressed the button
 * can read it out to somebody whose mail hasn't arrived. It is never stored
 * readable and never appears on the employee payload — this response is the
 * only place it exists outside the email.
 */
export interface AccountActionResult {
  message: string
  password: string
  employee: Employee
}

export interface EmployeeAccount {
  id: string
  email: string
  status: "invited" | "active" | "disabled"
  emailVerifiedAt: string | null
  lastLoginAt: string | null
  /** When their password was last emailed; null if it never has been. */
  credentialsSentAt: string | null
  /** Provisioned but never sent a password, so there is nothing to sign in with. */
  credentialsUnsent: boolean
  /** Admin required a new password before this account may use the app. */
  mustChangePassword: boolean
}

/**
 * The three typed slots of the reporting-manager hierarchy:
 *
 *   Employee → Primary Manager → (optional) Secondary Manager → Final Manager
 *
 * An ASSIGNMENT, not a system role. A Primary Manager holds whatever system
 * role they always held (usually just Employee) — these values never appear in
 * `Role`, and nothing keys authorization off them.
 */
export type ManagerLevel = "primary" | "secondary" | "final" | "project_manager" | "department_head"

/** The three slots the appraisal workflow reads. The other two sit outside it. */
export type ReviewChainLevel = "primary" | "secondary" | "final"

/**
 * Named slots rather than an array, because the position IS the meaning —
 * nobody should have to guess which entry is the final manager.
 */
export interface ManagerHierarchy {
  primary: EmployeeSummary | null
  secondary: EmployeeSummary | null
  final: EmployeeSummary | null
  /** §4's own slot — never inferred from `final`. */
  departmentHead: EmployeeSummary | null
  /** §4's one plural slot. */
  projectManagers: EmployeeSummary[]
  /**
   * The reporting line past the third level, in order — 4th level first. The
   * review chain stays three slots whatever this holds; these are reporting
   * lines, not reviewers.
   */
  additionalManagers: EmployeeSummary[]
}

export interface Employee {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  status: EmployeeStatus
  currentLevel: EmployeeLevel | null
  employmentType: string | null
  workLocation: string | null
  dateOfJoining: string | null
  department: Department | null
  designation: Designation | null
  managerHierarchy: ManagerHierarchy
  /** Primary and Final both filled. Secondary is optional and doesn't count. */
  managerHierarchyComplete: boolean
  /** Roles on the linked User account — empty when there is no account. */
  roles: Role[]
  user: EmployeeAccount | null
  phone: string | null
  personalEmail: string | null
  dateOfBirth: string | null
  gender: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  profilePhotoUrl: string | null
}

/**
 * Columns the list can be ordered by, mirroring EmployeesController::SORTABLE.
 * Anything else is ignored by the server rather than trusted into an ORDER BY,
 * so this type is the honest list of what the headers may offer.
 */
export type EmployeeSortKey =
  | "name"
  | "employeeCode"
  | "status"
  | "dateOfJoining"
  | "currentLevel"
  | "department"
  | "designation"

export interface EmployeeListParams {
  page?: number
  perPage?: number
  departmentId?: string
  designationId?: string
  status?: EmployeeStatus
  currentLevel?: EmployeeLevel
  q?: string
  /** Sorting happens in SQL across the whole set, never within the page. */
  sortBy?: EmployeeSortKey
  sortDir?: "asc" | "desc"
}

/**
 * Company-wide preferences.
 *
 * `employeeCodeInitial` is the first ID this company issues, e.g. "BOO1";
 * `nextEmployeeCode` is what the add-employee form would prefill right now,
 * derived from it and from the codes already in use. Both are null when
 * nothing is configured, which means "leave the field empty".
 */
export interface CompanySettings {
  employeeCodeInitial: string | null
  nextEmployeeCode: string | null
  /** Work emails must end with @<this>. null means no restriction. */
  workEmailDomain: string | null
}

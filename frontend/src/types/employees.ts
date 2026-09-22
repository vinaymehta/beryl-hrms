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
  status: "active" | "archived"
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
export interface EmployeeAccount {
  id: string
  email: string
  status: "invited" | "active" | "disabled"
  emailVerifiedAt: string | null
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

export interface EmployeeListParams {
  page?: number
  perPage?: number
  departmentId?: string
  designationId?: string
  status?: EmployeeStatus
  currentLevel?: EmployeeLevel
  q?: string
}

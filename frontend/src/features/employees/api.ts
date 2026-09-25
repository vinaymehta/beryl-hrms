import { apiClient } from "@/lib/api-client"
import type {
  AccountActionResult,
  CompanySettings,
  Employee,
  EmployeeListParams,
  Department,
  Designation,
} from "@/types/employees"
import type { Role } from "@/types/auth"
import type { EmployeePayload, DepartmentFormValues, DesignationFormValues } from "@/features/employees/schemas"

// GUESS: exact backend query-param names / response shape for employees,
// departments, designations not confirmed against a live backend (built in
// parallel) — camelCase query params matching the established convention
// (see docs/API_CONVENTIONS.md "ordinary GET query params"), paginated
// envelope via apiClient.getPaginated per the mail feature's precedent.
function toQuery(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
  if (!entries.length) return ""
  return `?${new URLSearchParams(entries as [string, string][]).toString()}`
}

interface CredentialOptions {
  password?: string
  forcePasswordChange?: boolean
}

/** Drops the keys the caller didn't set, so absence keeps meaning "unchanged". */
function credentialBody({ password, forcePasswordChange }: CredentialOptions) {
  return {
    ...(password ? { password } : {}),
    ...(forcePasswordChange === undefined ? {} : { forcePasswordChange }),
  }
}

export const employeesApi = {
  list: (params: EmployeeListParams = {}) =>
    apiClient.getPaginated<{ data: Employee[]; meta: { page: number; perPage: number; totalPages: number; totalCount: number } }>(
      `/employees${toQuery(params as Record<string, string | number | undefined>)}`
    ),
  get: (id: string) => apiClient.get<Employee>(`/employees/${id}`),
  create: (values: EmployeePayload) => apiClient.post<Employee>("/employees", values),
  update: (id: string, values: Partial<EmployeePayload>) => apiClient.patch<Employee>(`/employees/${id}`, values),
  // Hits the dedicated /deactivate endpoint (not the plain update route) so
  // it goes through its own permission check (employees.delete) and its own
  // audit trail entry, in both directions — status: "active" reactivates.
  deactivate: (id: string, status: "active" | "inactive" = "inactive") =>
    apiClient.patch<Employee>(`/employees/${id}/deactivate`, { status }),
  reactivate: (id: string) => apiClient.patch<Employee>(`/employees/${id}`, { status: "active" }),

  // Emails the employee their sign-in details for the first time.
  //
  // `password` is omitted to let the server generate one, which is the normal
  // case — the field on screen is prefilled with a generated value, and an
  // admin who clears it gets a fresh one rather than an empty password.
  //
  // `forcePasswordChange` is likewise omitted rather than sent as false when
  // the caller doesn't care: the backend reads absence as "leave whatever the
  // account already carries alone", so a plain re-send can't silently waive a
  // requirement an admin set earlier.
  invite: (id: string, options: CredentialOptions = {}) =>
    apiClient.post<AccountActionResult>(`/employees/${id}/invite`, credentialBody(options)),

  // Issues a NEW password and emails that. The same operation as invite now
  // that there is no link — they differ only in what the response says.
  resetPassword: (id: string, options: CredentialOptions = {}) =>
    apiClient.post<AccountActionResult>(`/employees/${id}/reset_password`, credentialBody(options)),

  // The code to prefill the add-employee form with. A suggestion the user can
  // overwrite, not a reservation — nothing is consumed by asking.
  nextCode: () => apiClient.get<{ employeeCode: string | null }>("/employees/next_code"),
}

/** Company-wide preferences. One row per company — the Company itself. */
export const companySettingsApi = {
  get: () => apiClient.get<CompanySettings>("/company_settings"),
  update: (values: { employeeCodeInitial: string }) =>
    apiClient.patch<CompanySettings>("/company_settings", values),
}

/**
 * The company's own roles, for the Employee form's role picker. Read-only by
 * design (backend RolesController) — creating and editing roles is Settings'
 * job, so this never offers a mutation.
 */
export const rolesApi = {
  list: () => apiClient.get<Role[]>("/roles"),
}

export const departmentsApi = {
  list: () => apiClient.get<Department[]>("/departments"),
  create: (values: DepartmentFormValues) => apiClient.post<Department>("/departments", values),
  update: (id: string, values: Partial<DepartmentFormValues>) =>
    apiClient.patch<Department>(`/departments/${id}`, values),
  // DELETE, not a status patch. The backend archives rather than destroying —
  // employees who were once in the department keep their history — but the
  // list excludes archived rows, so from here it is a delete.
  remove: (id: string) => apiClient.delete<void>(`/departments/${id}`),
}

export const designationsApi = {
  list: (departmentId?: string) => apiClient.get<Designation[]>(`/designations${toQuery({ departmentId })}`),
  create: (values: DesignationFormValues) => apiClient.post<Designation>("/designations", values),
  update: (id: string, values: Partial<DesignationFormValues>) =>
    apiClient.patch<Designation>(`/designations/${id}`, values),
  archive: (id: string) => apiClient.patch<Designation>(`/designations/${id}`, { status: "archived" }),
}

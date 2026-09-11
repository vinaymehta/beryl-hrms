import { apiClient } from "@/lib/api-client"
import type { Employee, EmployeeListParams, Department, Designation } from "@/types/employees"
import type { EmployeeFormValues, DepartmentFormValues, DesignationFormValues } from "@/features/employees/schemas"

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

export const employeesApi = {
  list: (params: EmployeeListParams = {}) =>
    apiClient.getPaginated<{ data: Employee[]; meta: { page: number; perPage: number; totalPages: number; totalCount: number } }>(
      `/employees${toQuery(params as Record<string, string | number | undefined>)}`
    ),
  get: (id: string) => apiClient.get<Employee>(`/employees/${id}`),
  create: (values: EmployeeFormValues) => apiClient.post<Employee>("/employees", values),
  update: (id: string, values: Partial<EmployeeFormValues>) => apiClient.patch<Employee>(`/employees/${id}`, values),
  // Hits the dedicated /deactivate endpoint (not the plain update route) so
  // it goes through its own permission check (employees.delete) and its own
  // audit trail entry, in both directions — status: "active" reactivates.
  deactivate: (id: string, status: "active" | "inactive" = "inactive") =>
    apiClient.patch<Employee>(`/employees/${id}/deactivate`, { status }),
  reactivate: (id: string) => apiClient.patch<Employee>(`/employees/${id}`, { status: "active" }),
}

export const departmentsApi = {
  list: () => apiClient.get<Department[]>("/departments"),
  create: (values: DepartmentFormValues) => apiClient.post<Department>("/departments", values),
  update: (id: string, values: Partial<DepartmentFormValues>) =>
    apiClient.patch<Department>(`/departments/${id}`, values),
  archive: (id: string) => apiClient.patch<Department>(`/departments/${id}`, { status: "archived" }),
}

export const designationsApi = {
  list: (departmentId?: string) => apiClient.get<Designation[]>(`/designations${toQuery({ departmentId })}`),
  create: (values: DesignationFormValues) => apiClient.post<Designation>("/designations", values),
  update: (id: string, values: Partial<DesignationFormValues>) =>
    apiClient.patch<Designation>(`/designations/${id}`, values),
  archive: (id: string) => apiClient.patch<Designation>(`/designations/${id}`, { status: "archived" }),
}

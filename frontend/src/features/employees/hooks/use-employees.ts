"use client"

import { useQuery } from "@tanstack/react-query"

import { employeesApi, departmentsApi, designationsApi, rolesApi } from "@/features/employees/api"
import type { EmployeeListParams } from "@/types/employees"

export function useEmployees(params: EmployeeListParams) {
  return useQuery({
    queryKey: ["employees", params],
    queryFn: () => employeesApi.list(params),
    placeholderData: (previousData) => previousData,
  })
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: ["employees", id],
    queryFn: () => employeesApi.get(id),
    enabled: !!id,
  })
}

export function useDepartments() {
  return useQuery({ queryKey: ["departments"], queryFn: departmentsApi.list })
}

/**
 * Every active employee, as candidates for all three manager dropdowns — "any
 * active employee can be selected", with no filtering by system role.
 * Server-side search keeps this usable past a page of results; the backend
 * caps perPage at 100.
 */
export function useAssignableManagers(search: string, enabled = true) {
  return useQuery({
    queryKey: ["employees", "assignable-managers", search],
    queryFn: () => employeesApi.list({ status: "active", perPage: 100, q: search || undefined }),
    placeholderData: (previousData) => previousData,
    enabled,
  })
}

/**
 * `enabled` is the permission gate, not an optimisation: GET /roles is closed
 * to anyone without employees.manage_roles (RolePolicy), so firing it for a
 * viewer who can only read their own profile buys a guaranteed 403.
 */
export function useRoles(enabled = true) {
  return useQuery({ queryKey: ["roles"], queryFn: rolesApi.list, enabled })
}

export function useDesignations(departmentId?: string) {
  return useQuery({
    queryKey: ["designations", departmentId],
    queryFn: () => designationsApi.list(departmentId),
  })
}

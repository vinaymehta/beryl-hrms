"use client"

import { useQuery } from "@tanstack/react-query"

import { employeesApi, departmentsApi, designationsApi } from "@/features/employees/api"
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

export function useDesignations(departmentId?: string) {
  return useQuery({
    queryKey: ["designations", departmentId],
    queryFn: () => designationsApi.list(departmentId),
  })
}

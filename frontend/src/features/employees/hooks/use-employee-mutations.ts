"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { employeesApi, departmentsApi, designationsApi } from "@/features/employees/api"
import { ApiError } from "@/types/api"
import type { EmployeeFormValues, DepartmentFormValues, DesignationFormValues } from "@/features/employees/schemas"

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: EmployeeFormValues) => employeesApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      toast.success("Employee added.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't add that employee.")),
  })
}

export function useUpdateEmployee(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: Partial<EmployeeFormValues>) => employeesApi.update(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      toast.success("Employee updated.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't update that employee.")),
  })
}

export function useDeactivateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => employeesApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      toast.success("Employee deactivated.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't deactivate that employee.")),
  })
}

export function useCreateDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: DepartmentFormValues) => departmentsApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] })
      toast.success("Department created.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't create that department.")),
  })
}

export function useCreateDesignation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: DesignationFormValues) => designationsApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["designations"] })
      toast.success("Designation created.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't create that designation.")),
  })
}

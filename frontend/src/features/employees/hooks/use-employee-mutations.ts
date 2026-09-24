"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { employeesApi, departmentsApi, designationsApi } from "@/features/employees/api"
import { ApiError } from "@/types/api"
import type { EmployeePayload, DepartmentFormValues, DesignationFormValues } from "@/features/employees/schemas"
import type { AccountActionResult } from "@/types/employees"

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: EmployeePayload) => employeesApi.create(values),
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
    mutationFn: (values: Partial<EmployeePayload>) => employeesApi.update(id, values),
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
    mutationFn: (id: string) => employeesApi.deactivate(id, "inactive"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      toast.success("Employee deactivated.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't deactivate that employee.")),
  })
}

export function useReactivateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => employeesApi.deactivate(id, "active"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      toast.success("Employee reactivated.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't reactivate that employee.")),
  })
}

/**
 * Invite, and Set/Reset password.
 *
 * One hook for both because they are the same interaction from the admin's
 * side — press a button, the employee gets a link — and because the success
 * message has to come from the SERVER rather than be assumed here: pressing
 * Reset on someone who never finished their invitation re-sends the invitation
 * instead, and the admin needs to be told that actually happened.
 */
function useAccountAction<TArgs>(
  action: (args: TArgs) => Promise<AccountActionResult>,
  fallback: string
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: action,
    onSuccess: (result: AccountActionResult) => {
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      toast.success(result.message)
    },
    onError: (error) => toast.error(errorMessage(error, fallback)),
  })
}

export function useInviteEmployee() {
  return useAccountAction(
    ({ id, forcePasswordChange }: { id: string; forcePasswordChange?: boolean }) =>
      employeesApi.invite(id, forcePasswordChange),
    "Couldn't send that invitation."
  )
}

export function useResetEmployeePassword() {
  return useAccountAction((id: string) => employeesApi.resetPassword(id), "Couldn't send that reset link.")
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

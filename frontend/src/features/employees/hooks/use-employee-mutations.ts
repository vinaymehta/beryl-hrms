"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { employeesApi, departmentsApi, designationsApi, employmentTypesApi } from "@/features/employees/api"
import { ApiError } from "@/types/api"
import type {
  EmployeePayload,
  DepartmentFormValues,
  DesignationFormValues,
  EmploymentTypeFormValues,
} from "@/features/employees/schemas"
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
 * Sending an employee their sign-in details, first time or again.
 *
 * One hook for both because they are now literally the same operation: a
 * password is generated (or taken from the admin), emailed, and whatever came
 * before it stops working. The success message still comes from the SERVER
 * rather than being assumed here, because what it should say depends on state
 * this side doesn't own — whether they'll be forced to change it, and whether
 * this replaced an existing password.
 */
interface AccountActionArgs {
  id: string
  /** Omitted to let the server generate one. */
  password?: string
  forcePasswordChange?: boolean
}

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
    ({ id, password, forcePasswordChange }: AccountActionArgs) =>
      employeesApi.invite(id, { password, forcePasswordChange }),
    "Couldn't send those sign-in details."
  )
}

export function useResetEmployeePassword() {
  return useAccountAction(
    ({ id, password, forcePasswordChange }: AccountActionArgs) =>
      employeesApi.resetPassword(id, { password, forcePasswordChange }),
    "Couldn't send that new password."
  )
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

export function useUpdateDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<DepartmentFormValues> }) =>
      departmentsApi.update(id, values),
    onSuccess: () => {
      // Employees carry their department, so a rename has to reach that list
      // too rather than leaving the old name showing until a reload.
      queryClient.invalidateQueries({ queryKey: ["departments"] })
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      toast.success("Department updated.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't update that department.")),
  })
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => departmentsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] })
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      toast.success("Department deleted.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't delete that department.")),
  })
}

export function useCreateDesignation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: DesignationFormValues) => designationsApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["designations"] })
      toast.success("Job title created.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't create that job title.")),
  })
}

export function useUpdateDesignation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<DesignationFormValues> }) =>
      designationsApi.update(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["designations"] })
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      toast.success("Job title updated.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't update that job title.")),
  })
}

export function useDeleteDesignation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => designationsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["designations"] })
      queryClient.invalidateQueries({ queryKey: ["departments"] })
      toast.success("Job title deleted.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't delete that job title.")),
  })
}

export function useCreateEmploymentType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: EmploymentTypeFormValues) => employmentTypesApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employment-types"] })
      toast.success("Designation created.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't create that designation.")),
  })
}

export function useUpdateEmploymentType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<EmploymentTypeFormValues> }) =>
      employmentTypesApi.update(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employment-types"] })
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      toast.success("Designation updated.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't update that designation.")),
  })
}

export function useDeleteEmploymentType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => employmentTypesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employment-types"] })
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      toast.success("Designation deleted.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't delete that designation.")),
  })
}

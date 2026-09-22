"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { employeeRecordsApi, appraisalFeedbackApi } from "@/features/employees/records-api"
import { ApiError } from "@/types/api"
import type { EmployeeRecordResource } from "@/types/employee-records"

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

export function useEmployeeRecords(employeeId: string, resource: EmployeeRecordResource, enabled = true) {
  return useQuery({
    queryKey: ["employee-records", employeeId, resource],
    queryFn: () => employeeRecordsApi.list(employeeId, resource),
    enabled: Boolean(employeeId) && enabled,
  })
}

/**
 * One mutation hook for create/update/delete across every record kind — they
 * all invalidate the same key and report the same way.
 */
export function useEmployeeRecordMutations(employeeId: string, resource: EmployeeRecordResource) {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["employee-records", employeeId, resource] })

  const save = useMutation({
    mutationFn: ({ id, values }: { id?: string; values: unknown }) =>
      id
        ? employeeRecordsApi.update(employeeId, resource, id, values)
        : employeeRecordsApi.create(employeeId, resource, values),
    onSuccess: () => {
      invalidate()
      toast.success("Saved.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't save that.")),
  })

  const remove = useMutation({
    mutationFn: (id: string) => employeeRecordsApi.remove(employeeId, resource, id),
    onSuccess: () => {
      invalidate()
      toast.success("Removed.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't remove that.")),
  })

  const validateSkill = useMutation({
    mutationFn: (id: string) => employeeRecordsApi.validateSkill(employeeId, id),
    onSuccess: () => {
      invalidate()
      toast.success("Skill validated.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't validate that skill.")),
  })

  return { save, remove, validateSkill }
}

export function useAppraisalFeedback(appraisalId: string, enabled = true) {
  return useQuery({
    queryKey: ["appraisal-feedback", appraisalId],
    queryFn: () => appraisalFeedbackApi.list(appraisalId),
    enabled: Boolean(appraisalId) && enabled,
  })
}

export function useAppraisalFeedbackMutations(appraisalId: string) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["appraisal-feedback", appraisalId] })

  const request = useMutation({
    mutationFn: (values: unknown) => appraisalFeedbackApi.create(appraisalId, values),
    onSuccess: () => {
      invalidate()
      toast.success("Feedback requested.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't request that feedback.")),
  })

  const respond = useMutation({
    mutationFn: ({ id, response }: { id: string; response: string }) =>
      appraisalFeedbackApi.respond(appraisalId, id, response),
    onSuccess: () => {
      invalidate()
      toast.success("Feedback submitted.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't submit that feedback.")),
  })

  return { request, respond }
}

"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  appraisalsApi,
  appraisalCyclesApi,
  appraisalTemplatesApi,
  notificationsApi,
} from "@/features/appraisals/api"
import { ApiError } from "@/types/api"

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

/** Every appraisal action returns the refreshed detail, so one invalidation set serves them all. */
function useAppraisalAction<TArgs>(
  id: string,
  mutationFn: (args: TArgs) => Promise<unknown>,
  successMessage: string,
  fallbackError: string
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appraisals"] })
      queryClient.invalidateQueries({ queryKey: ["appraisals", id] })
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
      toast.success(successMessage)
    },
    onError: (error) => toast.error(errorMessage(error, fallbackError)),
  })
}

export function useSubmitSelfAppraisal(id: string) {
  return useAppraisalAction(
    id,
    (values: unknown) => appraisalsApi.submitSelf(id, values),
    "Self-appraisal saved.",
    "Couldn't save that self-appraisal."
  )
}

export function useSubmitReview(id: string) {
  return useAppraisalAction(
    id,
    (values: unknown) => appraisalsApi.submitReview(id, values),
    "Review submitted.",
    "Couldn't submit that review."
  )
}

export function useAdvanceAppraisal(id: string) {
  return useAppraisalAction(
    id,
    ({ to, notes }: { to: string; notes?: string }) => appraisalsApi.advance(id, to, notes),
    "Appraisal moved on.",
    "Couldn't move that appraisal on."
  )
}

export function useReturnForCorrection(id: string) {
  return useAppraisalAction(
    id,
    (notes: string | undefined) => appraisalsApi.returnForCorrection(id, notes),
    "Returned for correction.",
    "Couldn't return that appraisal."
  )
}

export function useOverrideScore(id: string) {
  return useAppraisalAction(
    id,
    ({ score, reason }: { score: number; reason: string }) => appraisalsApi.overrideScore(id, score, reason),
    "Score calibrated.",
    "Couldn't override that score."
  )
}

export function useReleaseAppraisal(id: string) {
  return useAppraisalAction(
    id,
    (notes: string | undefined) => appraisalsApi.release(id, notes),
    "Appraisal released to the employee.",
    "Couldn't release that appraisal."
  )
}

export function useAcknowledgeAppraisal(id: string) {
  return useAppraisalAction(
    id,
    (note: string | undefined) => appraisalsApi.acknowledge(id, note),
    "Appraisal acknowledged.",
    "Couldn't record that acknowledgement."
  )
}

export function useAddAppraisalComment(id: string) {
  return useAppraisalAction(
    id,
    (values: unknown) => appraisalsApi.addComment(id, values),
    "Comment added.",
    "Couldn't add that comment."
  )
}

export function useSaveCompensation(id: string) {
  return useAppraisalAction(
    id,
    (values: unknown) => appraisalsApi.compensation(id, values),
    "Compensation decision saved.",
    "Couldn't save that decision."
  )
}

// --- Cycles -----------------------------------------------------------------

function useCycleAction<TArgs>(
  mutationFn: (args: TArgs) => Promise<unknown>,
  successMessage: string,
  fallbackError: string
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appraisal-cycles"] })
      queryClient.invalidateQueries({ queryKey: ["appraisals"] })
      toast.success(successMessage)
    },
    onError: (error) => toast.error(errorMessage(error, fallbackError)),
  })
}

export function useCreateAppraisalCycle() {
  return useCycleAction(
    (values: unknown) => appraisalCyclesApi.create(values),
    "Cycle created.",
    "Couldn't create that cycle."
  )
}

export function useUpdateAppraisalCycle(id: string) {
  return useCycleAction(
    (values: unknown) => appraisalCyclesApi.update(id, values),
    "Cycle updated.",
    "Couldn't update that cycle."
  )
}

export function useStartAppraisalCycle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => appraisalCyclesApi.start(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["appraisal-cycles"] })
      queryClient.invalidateQueries({ queryKey: ["appraisals"] })
      const skipped = result?.skipped?.length ?? 0
      toast.success(
        skipped > 0
          ? `Cycle started — ${result.createdCount} appraisals created, ${skipped} skipped.`
          : `Cycle started — ${result.createdCount} appraisals created.`
      )
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't start that cycle.")),
  })
}

export function useCloseAppraisalCycle() {
  return useCycleAction((id: string) => appraisalCyclesApi.close(id), "Cycle closed.", "Couldn't close that cycle.")
}

export function useCreateAppraisalTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: unknown) => appraisalTemplatesApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appraisal-templates"] })
      toast.success("Template created.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't create that template.")),
  })
}

export function useActivateTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => appraisalTemplatesApi.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appraisal-templates"] })
      toast.success("Template activated.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't activate that template.")),
  })
}

export function useNewTemplateVersion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => appraisalTemplatesApi.newVersion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appraisal-templates"] })
      toast.success("New draft version created.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't create a new version.")),
  })
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  })
}

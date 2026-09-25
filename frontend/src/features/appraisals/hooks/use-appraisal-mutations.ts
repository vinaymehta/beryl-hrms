"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  appraisalsApi,
  appraisalCyclesApi,
  appraisalTemplatesApi,
  notificationsApi,
} from "@/features/appraisals/api"
import { errorMessage } from "@/lib/errors"

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
    onSuccess: (data) => {
      // Seed the detail cache from the response the action already returned,
      // rather than waiting on the refetch the invalidation triggers. It is
      // the same payload either way, so this only changes WHEN it lands — and
      // for a comment that matters: the author should see their own comment
      // appear as they post it, not a moment later.
      if (data) queryClient.setQueryData(["appraisals", id], data)

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

/**
 * Saving a step is background housekeeping, not an event worth a toast on every
 * click — the wizard shows the saved time instead. A FAILED save still speaks
 * up, because silently losing someone's half-written appraisal is the one
 * outcome that matters here.
 */
export function useSaveSelfAppraisalDraft(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: unknown) => appraisalsApi.saveDraft(id, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appraisals", id] }),
    onError: (error) => toast.error(errorMessage(error, "Couldn't save your draft.")),
  })
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

export function useDeleteAppraisalCycle() {
  return useCycleAction(
    (id: string) => appraisalCyclesApi.remove(id),
    "Cycle deleted.",
    "Couldn't delete that cycle."
  )
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

export function useUpdateAppraisalTemplate(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: unknown) => appraisalTemplatesApi.update(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appraisal-templates"] })
      toast.success("Template updated.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't update that template.")),
  })
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => appraisalTemplatesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appraisal-templates"] })
      toast.success("Template deleted.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't delete that template.")),
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

/**
 * Marks ONE notification read — what opening it should mean. Failure is
 * swallowed on purpose: the click's real job is to follow the link, and a
 * navigation must not be interrupted by a toast about a read receipt.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: () => {},
  })
}

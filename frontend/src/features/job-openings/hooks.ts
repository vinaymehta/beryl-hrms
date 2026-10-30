"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { jobOpeningsApi } from "@/features/job-openings/api"
import { errorMessage } from "@/lib/errors"
import type { JobOpening, JobOpeningInput } from "@/types/job-openings"

const listKey = ["job-openings"] as const
const detailKey = (id: number) => ["job-openings", id] as const

/** `enabled` is the permission gate: the endpoint is closed without job_openings.manage. */
export function useJobOpenings(enabled = true) {
  return useQuery({ queryKey: listKey, queryFn: jobOpeningsApi.list, enabled })
}

export function useJobOpening(id: number | null, enabled = true) {
  return useQuery({
    queryKey: detailKey(id ?? 0),
    queryFn: () => jobOpeningsApi.get(id as number),
    enabled: enabled && id !== null,
  })
}

export function useSuggestedIdentifiers(
  params: { title: string; category: string; code?: string; slug?: string; exceptId?: number },
  enabled = true
) {
  return useQuery({
    queryKey: ["job-openings", "identifiers", params],
    queryFn: () => jobOpeningsApi.suggestIdentifiers(params),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 5_000,
  })
}

/**
 * Saving is the form's to report: it puts field errors under their inputs, so
 * there is no blanket error toast here.
 */
export function useSaveJobOpening(id: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: JobOpeningInput) => (id ? jobOpeningsApi.update(id, input) : jobOpeningsApi.create(input)),
    onSuccess: (opening) => {
      queryClient.setQueryData(detailKey(opening.id), opening)
      return queryClient.invalidateQueries({ queryKey: listKey, exact: true })
    },
  })
}

/**
 * The actions of an opening's ⋯ menu, on the list and the detail page. Each
 * refreshes the list and the opening's own page, and reports its own outcome.
 */
export function useJobOpeningActions() {
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: listKey })

  const setActive = useMutation({
    mutationFn: ({ opening, active }: { opening: JobOpening; active: boolean }) =>
      active ? jobOpeningsApi.activate(opening.id) : jobOpeningsApi.pause(opening.id),
    onSuccess: (opening) => {
      queryClient.setQueryData(detailKey(opening.id), opening)
      toast.success(opening.isActive ? `“${opening.title}” is live on the website.` : `“${opening.title}” is paused.`, {
        description: opening.isActive ? undefined : "It no longer shows on the careers website.",
      })
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't change the opening's status.")),
    onSettled: refresh,
  })

  const duplicate = useMutation({
    mutationFn: (opening: JobOpening) => jobOpeningsApi.duplicate(opening.id),
    onSuccess: (copy) =>
      toast.success(`Created “${copy.title}”.`, { description: "It's paused — edit it, then activate it to publish." }),
    onError: (error) => toast.error(errorMessage(error, "Couldn't duplicate the opening.")),
    onSettled: refresh,
  })

  const remove = useMutation({
    mutationFn: (opening: JobOpening) => jobOpeningsApi.remove(opening.id),
    onSuccess: (_, opening) => {
      queryClient.removeQueries({ queryKey: detailKey(opening.id) })
      toast.success(`Deleted “${opening.title}”.`)
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't delete the opening.")),
    onSettled: refresh,
  })

  // Optimistic: the row moves at once, and a failure puts the server's order back.
  const reorder = useMutation({
    // `moved` names the opening for a "Moved to top/bottom" toast; plain up/down steps pass none.
    mutationFn: ({ ordered }: { ordered: JobOpening[]; moved?: string }) =>
      jobOpeningsApi.reorder(ordered.map((opening) => opening.id)),
    onMutate: async ({ ordered }) => {
      await queryClient.cancelQueries({ queryKey: listKey, exact: true })
      const previous = queryClient.getQueryData<JobOpening[]>(listKey)
      queryClient.setQueryData(listKey, ordered)
      return { previous }
    },
    onSuccess: (list, { moved }) => {
      queryClient.setQueryData(listKey, list)
      for (const opening of list) queryClient.setQueryData(detailKey(opening.id), opening)
      if (moved) toast.success(moved)
    },
    onError: (error, _, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous)
      toast.error(errorMessage(error, "Couldn't save the new order."))
      refresh()
    },
  })

  return { setActive, duplicate, remove, reorder }
}

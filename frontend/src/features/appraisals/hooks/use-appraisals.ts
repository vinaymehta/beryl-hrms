"use client"

import { useEffect } from "react"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  appraisalsApi,
  appraisalCyclesApi,
  appraisalTemplatesApi,
  notificationsApi,
} from "@/features/appraisals/api"
import { subscribe } from "@/lib/cable"
import type { AppraisalListParams } from "@/types/appraisals"

export function useAppraisalCycles(status?: string, enabled = true) {
  return useQuery({
    queryKey: ["appraisal-cycles", status ?? "all"],
    queryFn: () => appraisalCyclesApi.list(status),
    enabled,
  })
}

export function useAppraisalCycle(id: string | null) {
  return useQuery({
    queryKey: ["appraisal-cycles", id],
    queryFn: () => appraisalCyclesApi.get(id as string),
    enabled: Boolean(id),
  })
}

export function useAppraisalTemplates(status?: string, enabled = true) {
  return useQuery({
    queryKey: ["appraisal-templates", status ?? "all"],
    queryFn: () => appraisalTemplatesApi.list(status),
    enabled,
  })
}

/** One template, used by the builder when it opens as a new version of it. */
export function useAppraisalTemplate(id: string | null | undefined) {
  return useQuery({
    queryKey: ["appraisal-templates", "detail", id],
    queryFn: () => appraisalTemplatesApi.get(id as string),
    enabled: Boolean(id),
  })
}

export function useAppraisals(params: AppraisalListParams = {}, enabled = true) {
  return useQuery({
    queryKey: ["appraisals", params],
    queryFn: () => appraisalsApi.list(params),
    enabled,
    // Searching and paging change the key, which would otherwise blank the
    // list back to a loading state on every keystroke. Holding the previous
    // page until the next one arrives means the rows dim and update rather
    // than flashing away and back.
    placeholderData: keepPreviousData,
  })
}

/**
 * The full detail, including the `viewer` block that says what this user may
 * do. Everything the UI shows or offers keys off that block rather than
 * re-deriving an authorization rule the backend already decided.
 */
export function useAppraisal(id: string | null) {
  return useQuery({
    queryKey: ["appraisals", String(id)],
    queryFn: () => appraisalsApi.get(id as string),
    enabled: Boolean(id),
  })
}

/**
 * The letter PDF as an object URL for the in-page preview. Keyed on what makes
 * it a different file — signing swaps the issued letter for the signed copy —
 * and never stale otherwise: a PDF that has been issued does not change.
 *
 * The object URLs are not revoked. Each is a small PDF held until the page is
 * left, and revoking from an effect would break the frame under Strict Mode's
 * double-run on mount.
 */
export function useAppraisalLetter(
  id: string,
  version: string,
  enabled = true,
  { draft = false }: { draft?: boolean } = {}
) {
  return useQuery({
    queryKey: ["appraisal-letter", String(id), draft ? "draft" : version],
    queryFn: async () => URL.createObjectURL(await appraisalsApi.letterBlob(id, { draft })),
    enabled,
    // A draft follows the saved decision, so it is read afresh on every open.
    staleTime: draft ? 0 : Infinity,
    gcTime: draft ? 0 : undefined,
    retry: false,
  })
}

export function useCalibration(cycleId: string | null) {
  return useQuery({
    queryKey: ["appraisal-calibration", cycleId],
    queryFn: () => appraisalCyclesApi.calibration(cycleId as string),
    enabled: Boolean(cycleId),
  })
}

/**
 * The bell's feed, kept current by NotificationsChannel rather than by
 * polling: the server pushes "changed" the moment a notification is raised or
 * read, and the list is re-read then. It is also re-read on every (re)connect,
 * to pick up anything raised while the socket was down.
 *
 * Every workflow step — submitted, reviewed, released, the letter signed —
 * raises a notification to the people it concerns, so the same push also
 * re-reads the appraisals on screen. Without it an admin looking at an
 * appraisal only saw the employee's signature after a refresh.
 */
export function useNotifications(enabled = true) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enabled) return
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
      // Only what is mounted is fetched again; the rest is marked stale.
      queryClient.invalidateQueries({ queryKey: ["appraisals"] })
    }
    return subscribe("NotificationsChannel", { received: refresh, connected: refresh })
  }, [enabled, queryClient])

  return useQuery({
    queryKey: ["notifications"],
    queryFn: notificationsApi.list,
    enabled,
    // Pushed, so neither a timer nor a window focus needs to ask again.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

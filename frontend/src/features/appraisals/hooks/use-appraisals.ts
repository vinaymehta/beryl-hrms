"use client"

import { useQuery } from "@tanstack/react-query"

import {
  appraisalsApi,
  appraisalCyclesApi,
  appraisalTemplatesApi,
  notificationsApi,
} from "@/features/appraisals/api"
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
  })
}

/**
 * The full detail, including the `viewer` block that says what this user may
 * do. Everything the UI shows or offers keys off that block rather than
 * re-deriving an authorization rule the backend already decided.
 */
export function useAppraisal(id: string | null) {
  return useQuery({
    queryKey: ["appraisals", id],
    queryFn: () => appraisalsApi.get(id as string),
    enabled: Boolean(id),
  })
}

export function useCalibration(cycleId: string | null) {
  return useQuery({
    queryKey: ["appraisal-calibration", cycleId],
    queryFn: () => appraisalCyclesApi.calibration(cycleId as string),
    enabled: Boolean(cycleId),
  })
}

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: notificationsApi.list,
    enabled,
    refetchInterval: 60_000,
  })
}

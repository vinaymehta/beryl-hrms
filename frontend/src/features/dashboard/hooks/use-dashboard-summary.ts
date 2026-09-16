"use client"

import { useQuery } from "@tanstack/react-query"

import { dashboardApi } from "@/features/dashboard/api"

// `enabled` lets the page skip the request entirely when it is about to
// redirect — an employee bounced to their own record has no use for the
// company summary, and asking for it would be a call they may not be
// entitled to make.
export function useDashboardSummary(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: dashboardApi.summary,
    staleTime: 30_000,
    enabled: options?.enabled ?? true,
  })
}

"use client"

import { useQuery } from "@tanstack/react-query"

import { dashboardApi } from "@/features/dashboard/api"

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: dashboardApi.summary,
    staleTime: 30_000,
  })
}

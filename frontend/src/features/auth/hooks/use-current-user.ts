"use client"

import { useQuery } from "@tanstack/react-query"

import { authApi } from "@/features/auth/api"
import { ApiError } from "@/types/api"

export const CURRENT_USER_QUERY_KEY = ["auth", "me"] as const

/**
 * Source of truth for client-side auth state. A 401 means "not logged in"
 * (expected, not an error state) — every other failure is surfaced normally.
 */
export function useCurrentUser() {
  const query = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: authApi.me,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) return false
      return failureCount < 2
    },
    staleTime: 60_000,
  })

  const isUnauthenticated = query.isError && query.error instanceof ApiError && query.error.status === 401

  return {
    user: query.data,
    isLoading: query.isLoading,
    isAuthenticated: !!query.data,
    isUnauthenticated,
    refetch: query.refetch,
  }
}

"use client"

import { useQuery } from "@tanstack/react-query"

import { authApi } from "@/features/auth/api"

export function useSessions() {
  return useQuery({
    queryKey: ["auth", "sessions"],
    queryFn: authApi.sessions,
  })
}

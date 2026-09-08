"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { attendanceApi } from "@/features/attendance/api"
import { ApiError } from "@/types/api"

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

export function useTodayAttendance() {
  return useQuery({ queryKey: ["attendance", "today"], queryFn: attendanceApi.today })
}

export function useAttendanceHistory(params: { from?: string; to?: string }) {
  return useQuery({ queryKey: ["attendance", "history", params], queryFn: () => attendanceApi.list(params) })
}

export function useCheckInOut() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["attendance"] })

  const checkIn = useMutation({
    mutationFn: attendanceApi.checkIn,
    onSuccess: () => {
      invalidate()
      toast.success("Checked in.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't check in.")),
  })
  const checkOut = useMutation({
    mutationFn: attendanceApi.checkOut,
    onSuccess: () => {
      invalidate()
      toast.success("Checked out.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't check out.")),
  })
  return { checkIn, checkOut }
}

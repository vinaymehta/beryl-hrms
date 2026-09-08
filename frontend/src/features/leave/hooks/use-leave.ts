"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { leaveApi } from "@/features/leave/api"
import { ApiError } from "@/types/api"
import type { LeaveRequestValues } from "@/features/leave/schemas"

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

export function useMyLeaveRequests() {
  return useQuery({ queryKey: ["leaves", "mine"], queryFn: leaveApi.listMine })
}

export function usePendingLeaveRequests() {
  return useQuery({ queryKey: ["leaves", "pending"], queryFn: leaveApi.listPending })
}

export function useRequestLeave() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: LeaveRequestValues) => leaveApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] })
      toast.success("Leave request submitted.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't submit that request.")),
  })
}

export function useReviewLeaveRequest() {
  const queryClient = useQueryClient()
  const approve = useMutation({
    mutationFn: (id: string) => leaveApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] })
      toast.success("Leave request approved.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't approve that request.")),
  })
  const reject = useMutation({
    mutationFn: ({ id, reviewNote }: { id: string; reviewNote: string }) => leaveApi.reject(id, reviewNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] })
      toast.success("Leave request rejected.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't reject that request.")),
  })
  return { approve, reject }
}

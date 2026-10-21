"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { salaryApi } from "@/features/salary/api"
import { errorMessage } from "@/lib/errors"

const runKey = (month: string) => ["salary", "run", month] as const

/**
 * `enabled` is the permission gate: the endpoint is closed without salary.send.
 * `polling` re-reads the run every two seconds — while slips queued for email
 * are still on their way, so each row turns Sent as its mail goes out.
 */
export function useSalaryRun(month: string, { enabled = true, polling = false } = {}) {
  return useQuery({
    queryKey: runKey(month),
    queryFn: () => salaryApi.run(month),
    enabled,
    refetchInterval: polling ? 2000 : false,
  })
}

/**
 * Only the failure toast lives here. What succeeded is per employee, so the
 * page reports it — it has the rows to mark.
 */
export function useGenerateSalarySlips(month: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ employeeIds, regenerate = false }: { employeeIds: number[]; regenerate?: boolean }) =>
      salaryApi.generate(month, employeeIds, regenerate),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: runKey(month) }),
    onError: (error) => toast.error(errorMessage(error, "Couldn't generate the salary slips.")),
  })
}

export function useSendSalarySlips(month: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ slipIds, resend = false }: { slipIds: number[]; resend?: boolean }) =>
      salaryApi.send(slipIds, resend),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: runKey(month) }),
    onError: (error) => toast.error(errorMessage(error, "Couldn't send the salary slips.")),
  })
}

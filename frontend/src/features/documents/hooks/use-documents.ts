"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { documentsApi, type UploadDocumentInput } from "@/features/documents/api"
import { ApiError } from "@/types/api"

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

// Keyed by employee so one employee's list can't be served from another's
// cache entry, and so uploading against one record doesn't blank the others.
function documentsKey(employeeId?: string) {
  return employeeId ? ["documents", employeeId] : ["documents"]
}

export function useDocuments(employeeId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: documentsKey(employeeId),
    queryFn: () => documentsApi.list(employeeId),
    enabled: options?.enabled ?? true,
  })
}

export function useUploadDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UploadDocumentInput) => documentsApi.upload(input),
    onSuccess: (_data, input) => {
      // Both the per-employee list and any unfiltered one showing this row.
      queryClient.invalidateQueries({ queryKey: documentsKey(input.employeeId) })
      queryClient.invalidateQueries({ queryKey: ["documents"] })
      toast.success("Document uploaded.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't upload that document.")),
  })
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] })
      toast.success("Document deleted.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't delete that document.")),
  })
}

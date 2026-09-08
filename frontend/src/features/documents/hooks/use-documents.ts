"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { documentsApi } from "@/features/documents/api"
import { ApiError } from "@/types/api"

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

export function useDocuments() {
  return useQuery({ queryKey: ["documents"], queryFn: documentsApi.list })
}

export function useUploadDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ file, documentType }: { file: File; documentType: string }) =>
      documentsApi.upload(file, documentType),
    onSuccess: () => {
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

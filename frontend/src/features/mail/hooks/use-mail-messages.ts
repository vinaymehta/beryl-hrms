"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import { mailApi } from "@/features/mail/api"
import type { MailFolder } from "@/types/mail"

export function useMailMessages(params: {
  connectionId: string | undefined
  folder?: MailFolder
  folderId?: string
  page: number
}) {
  return useQuery({
    queryKey: ["mail", "messages", params.connectionId, params.folder, params.folderId, params.page],
    queryFn: () =>
      mailApi.messages.list({
        connectionId: params.connectionId as string,
        folder: params.folder,
        folderId: params.folderId,
        page: params.page,
      }),
    enabled: !!params.connectionId,
    placeholderData: (previous) => previous,
  })
}

export function useMailMessage(params: {
  connectionId: string | undefined
  id: string | undefined
  folderId?: string
  from?: string
  to?: string
  subject?: string
}) {
  return useQuery({
    queryKey: ["mail", "message", params.connectionId, params.id],
    queryFn: () =>
      mailApi.messages.get({
        connectionId: params.connectionId as string,
        id: params.id as string,
        folderId: params.folderId,
        from: params.from,
        to: params.to,
        subject: params.subject,
      }),
    enabled: !!params.connectionId && !!params.id,
  })
}

export function useMailSearch(params: { connectionId: string | undefined; q: string; page: number }) {
  return useQuery({
    queryKey: ["mail", "search", params.connectionId, params.q, params.page],
    queryFn: () => mailApi.search({ connectionId: params.connectionId as string, q: params.q, page: params.page }),
    enabled: !!params.connectionId && params.q.trim().length > 0,
    placeholderData: (previous) => previous,
  })
}

export function useMailStats(connectionId: string | undefined) {
  return useQuery({
    queryKey: ["mail", "stats", connectionId],
    queryFn: () => mailApi.stats(connectionId as string),
    enabled: !!connectionId,
    staleTime: 30_000,
  })
}

export function useMailFolders(connectionId: string | undefined) {
  return useQuery({
    queryKey: ["mail", "folders", connectionId],
    queryFn: () => mailApi.folders.list(connectionId as string),
    enabled: !!connectionId,
    staleTime: 30_000,
  })
}

export function useMarkMailRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ connectionId, messageId, read = true }: { connectionId: string; messageId: string; read?: boolean }) =>
      mailApi.messages.markRead(connectionId, messageId, read),
    onMutate: async ({ connectionId, messageId, read = true }) => {
      // Optimistically update message in lists
      queryClient.setQueriesData({ queryKey: ["mail", "messages"] }, (old: any) => {
        if (!old?.data) return old
        return {
          ...old,
          data: old.data.map((msg: any) => (msg.id === messageId ? { ...msg, isRead: read } : msg)),
        }
      })
      // Optimistically update single message cache
      queryClient.setQueryData(["mail", "message", connectionId, messageId], (old: any) => {
        if (!old) return old
        return { ...old, isRead: read }
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["mail", "messages"] })
      queryClient.invalidateQueries({ queryKey: ["mail", "stats"] })
      queryClient.invalidateQueries({ queryKey: ["mail", "folders"] })
    },
  })
}

export function useDeleteMailMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ connectionId, messageId, folderId }: { connectionId: string; messageId: string; folderId?: string }) =>
      mailApi.messages.delete(connectionId, messageId, folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mail", "messages"] })
      queryClient.invalidateQueries({ queryKey: ["mail", "stats"] })
      queryClient.invalidateQueries({ queryKey: ["mail", "folders"] })
    },
  })
}

export function useSendMailMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: import("@/types/mail").SendMessageParams) => mailApi.messages.send(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mail", "messages"] })
      queryClient.invalidateQueries({ queryKey: ["mail", "stats"] })
      queryClient.invalidateQueries({ queryKey: ["mail", "folders"] })
    },
  })
}

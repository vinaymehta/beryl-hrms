"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import { mailApi } from "@/features/mail/api"
import type { MailFolder, MailMessageDetail, MailMessageSummary } from "@/types/mail"
import type { PaginatedResponse } from "@/types/api"

/** How often the Mail page re-checks Zoho for new mail. The message list
 *  and the stats/KPI cards poll on the SAME interval on purpose: they
 *  describe the same mailbox, so refreshing them independently is what let
 *  a newly arrived mail show in the list while the Unread card still
 *  showed the pre-arrival number. */
export const MAIL_POLL_INTERVAL_MS = 60_000

export function useMailMessages(params: {
  connectionId: string | undefined
  folder?: MailFolder
  folderId?: string
  page: number
  /** A live date-range view of the mailbox (real Zoho data, fetched now) —
   *  unrelated to automatic new-mail scanning, which has its own cursor. */
  dateFrom?: string
  dateTo?: string
}) {
  return useQuery({
    queryKey: ["mail", "messages", params.connectionId, params.folder, params.folderId, params.page, params.dateFrom, params.dateTo],
    queryFn: () =>
      mailApi.messages.list({
        connectionId: params.connectionId as string,
        folder: params.folder,
        folderId: params.folderId,
        page: params.page,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      }),
    enabled: !!params.connectionId,
    placeholderData: (previous) => previous,
    // Without this, new mail only ever appeared after a manual page refresh.
    refetchInterval: MAIL_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
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

/** `range` is the Mail page's active date filter — passing it makes every
 *  count describe only that range, so the KPI cards always agree with the
 *  message list the same filter produced. */
export function useMailStats(connectionId: string | undefined, range?: { from: string; to: string } | null) {
  return useQuery({
    queryKey: ["mail", "stats", connectionId, range?.from, range?.to],
    queryFn: () => mailApi.stats(connectionId as string, false, range),
    enabled: !!connectionId,
    // Deliberately NOT the app-wide 30s staleTime: the message list is
    // uncached and refetches on mount, so a stale-but-fresh-enough stats
    // entry would be served from cache while the list showed newer mail —
    // the Unread card then sat on the pre-arrival count. Polls in lockstep
    // with the list instead.
    staleTime: 0,
    refetchInterval: MAIL_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
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
      queryClient.setQueriesData<PaginatedResponse<MailMessageSummary>>(
        { queryKey: ["mail", "messages"] },
        (old) => {
          if (!old?.data) return old
          return {
            ...old,
            data: old.data.map((msg) => (msg.id === messageId ? { ...msg, isRead: read } : msg)),
          }
        }
      )
      // Optimistically update single message cache
      queryClient.setQueryData<MailMessageDetail>(
        ["mail", "message", connectionId, messageId],
        (old) => (old ? { ...old, isRead: read } : old)
      )
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

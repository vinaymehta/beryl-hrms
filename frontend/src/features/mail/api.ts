import { apiClient } from "@/lib/api-client"
import { ApiError } from "@/types/api"
import type { PaginatedResponse } from "@/types/api"
import {
  MAIL_ERROR_CODES,
  type MailConnection,
  type MailConnectionType,
  type MailFolder,
  type MailMessageDetail,
  type MailMessageSummary,
} from "@/types/mail"

export const mailApi = {
  connections: {
    list: () => apiClient.get<MailConnection[]>("/mail/connections"),

    // No date range is asked for at connect time — the Mail page's own
    // filter is the single source of truth for historical fetching.
    connect: (type: MailConnectionType) => {
      // Backend routes use "company" not "company_managed" for the URL slug.
      const slug = type === "company_managed" ? "company" : type
      return apiClient.post<{ authorizationUrl: string }>(`/mail/connections/${slug}`)
    },

    disconnect: (id: string) => apiClient.delete<void>(`/mail/connections/${id}`),
  },

  // range: the Mail page's active date filter — with it, every count
  // describes only that range, so the KPI cards agree with the message
  // list the same filter produced.
  stats: (connectionId: string, refresh: boolean = false, range?: { from: string; to: string } | null) =>
    apiClient.get<import("@/types/mail").MailStats>(
      `/mail/stats?${new URLSearchParams({
        connectionId,
        ...(refresh ? { refresh: "true" } : {}),
        ...(range ? { dateFrom: range.from, dateTo: range.to } : {}),
      })}`
    ),

  folders: {
    list: (connectionId: string) =>
      apiClient.get<import("@/types/mail").MailFolderDetail[]>(
        `/mail/folders?connectionId=${encodeURIComponent(connectionId)}`
      ),
  },

  messages: {
    // dateFrom/dateTo: a live view of the mailbox filtered to that range —
    // real messages fetched from Zoho right now, walked and filtered
    // server-side (see Mail::DateFilteredMessages). Independent of the
    // Mail Settings historical-fetch feature entirely; passing these never
    // touches that background job or its stored range.
    list: (params: { connectionId: string; folder?: MailFolder; folderId?: string; page?: number; dateFrom?: string; dateTo?: string }) =>
      apiClient.getPaginated<PaginatedResponse<MailMessageSummary>>(
        `/mail/messages?${new URLSearchParams({
          connectionId: params.connectionId,
          ...(params.folder ? { folder: params.folder } : {}),
          ...(params.folderId ? { folderId: params.folderId } : {}),
          ...(params.page ? { page: String(params.page) } : {}),
          ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
          ...(params.dateTo ? { dateTo: params.dateTo } : {}),
        })}`
      ),

    // folderId/from/to/subject are optional hints carried over from the
    // message list this was opened from — see messages_controller#show for
    // why they're needed (Zoho's own message-by-id lookup is unreliable).
    get: (params: { connectionId: string; id: string; folderId?: string; from?: string; to?: string; subject?: string }) =>
      apiClient.get<MailMessageDetail>(
        `/mail/messages/${params.id}?${new URLSearchParams({
          connectionId: params.connectionId,
          ...(params.folderId ? { folderId: params.folderId } : {}),
          ...(params.from ? { from: params.from } : {}),
          ...(params.to ? { to: params.to } : {}),
          ...(params.subject ? { subject: params.subject } : {}),
        })}`
      ),

    send: (params: import("@/types/mail").SendMessageParams) =>
      apiClient.post<{ messageId: string }>(
        `/mail/messages?connectionId=${encodeURIComponent(params.connectionId)}`,
        {
          toAddress: params.to,
          subject: params.subject,
          content: params.body,
          ...(params.cc ? { ccAddress: params.cc } : {}),
          ...(params.bcc ? { bccAddress: params.bcc } : {}),
        }
      ),

    markRead: (connectionId: string, messageId: string, read: boolean = true) =>
      apiClient.patch<{ id: string; isRead: boolean }>(
        `/mail/messages/${encodeURIComponent(messageId)}/read?connectionId=${encodeURIComponent(connectionId)}`,
        { read }
      ),

    delete: (connectionId: string, messageId: string, folderId?: string) =>
      apiClient.delete<void>(
        `/mail/messages/${encodeURIComponent(messageId)}?${new URLSearchParams({
          connectionId,
          ...(folderId ? { folderId } : {}),
        })}`
      ),

    attachmentUrl: (connectionId: string, messageId: string, attachmentId: string) => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
      return `${baseUrl}/api/v1/mail/messages/${messageId}/attachments/${attachmentId}?connectionId=${encodeURIComponent(connectionId)}`
    },
  },

  search: (params: { connectionId: string; q: string; page?: number }) =>
    apiClient.getPaginated<PaginatedResponse<MailMessageSummary>>(
      `/mail/search?${new URLSearchParams({
        connectionId: params.connectionId,
        q: params.q,
        ...(params.page ? { page: String(params.page) } : {}),
      })}`
    ),
}

/** True when a mail request failed because the connection needs reconnecting
 *  (either Zoho revoked/expired the token pair, or the connection was
 *  already marked inactive before the call was made). */
export function isMailReauthError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.errors.some(
      (e) => e.code === MAIL_ERROR_CODES.tokenExpired || e.code === MAIL_ERROR_CODES.connectionInactive
    )
  )
}

/** True when a mail request failed because Zoho's API is (temporarily) throttling us. */
export function isMailRateLimitError(error: unknown): boolean {
  return error instanceof ApiError && error.errors.some((e) => e.code === MAIL_ERROR_CODES.rateLimited)
}

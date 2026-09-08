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

    connect: (type: MailConnectionType) => {
      // Backend routes use "company" not "company_managed" for the URL slug.
      const slug = type === "company_managed" ? "company" : type
      return apiClient.post<{ authorizationUrl: string }>(`/mail/connections/${slug}`)
    },

    disconnect: (id: string) => apiClient.delete<void>(`/mail/connections/${id}`),
  },

  stats: (connectionId: string, refresh: boolean = false) =>
    apiClient.get<import("@/types/mail").MailStats>(
      `/mail/stats?connectionId=${encodeURIComponent(connectionId)}${refresh ? "&refresh=true" : ""}`
    ),

  folders: {
    list: (connectionId: string) =>
      apiClient.get<import("@/types/mail").MailFolderDetail[]>(
        `/mail/folders?connectionId=${encodeURIComponent(connectionId)}`
      ),
  },

  messages: {
    list: (params: { connectionId: string; folder?: MailFolder; folderId?: string; page?: number }) =>
      apiClient.getPaginated<PaginatedResponse<MailMessageSummary>>(
        `/mail/messages?${new URLSearchParams({
          connectionId: params.connectionId,
          ...(params.folder ? { folder: params.folder } : {}),
          ...(params.folderId ? { folderId: params.folderId } : {}),
          ...(params.page ? { page: String(params.page) } : {}),
        })}`
      ),

    get: (params: { connectionId: string; id: string }) =>
      apiClient.get<MailMessageDetail>(
        `/mail/messages/${params.id}?${new URLSearchParams({ connectionId: params.connectionId })}`
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

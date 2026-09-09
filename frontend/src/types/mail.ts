// "company_managed" (not "company") to match the backend's ZohoConnection
// enum exactly — named that way there to avoid ambiguity with the model's
// own `belongs_to :company` association.
export type MailConnectionType = "company_managed" | "individual"
export type MailConnectionStatus = "active" | "error" | "revoked"
export type MailFolder = "inbox" | "sent" | "drafts" | "trash" | "spam" | (string & {})

export interface MailConnection {
  id: string
  connectionType: MailConnectionType
  emailAddress: string
  status: MailConnectionStatus
  lastSyncedAt: string | null
}

export interface MailAttachment {
  id: string
  name: string
  size: number
}

export interface MailMessageSummary {
  id: string
  from: string
  to: string
  subject: string
  snippet: string
  receivedAt: string
  isRead: boolean
  hasAttachment?: boolean
}

export interface MailMessageDetail {
  id: string
  from: string
  to: string
  subject: string
  body: string
  receivedAt: string
  isRead?: boolean
  hasAttachment?: boolean
  attachments?: MailAttachment[]
}

export interface MailFolderDetail {
  id: string
  name: string
  path: string
  unreadCount: number
  totalCount: number
}

export interface MailStats {
  accountId: string
  emailAddress: string
  displayName: string
  status: string
  totalMessages: number
  totalUnread: number
  inboxCount: number
  inboxUnread: number
  sentCount: number
  draftsCount: number
  trashCount?: number
  spamCount?: number
  folders: MailFolderDetail[]
}

export interface SendMessageParams {
  connectionId: string
  to: string
  subject: string
  body: string
  cc?: string
  bcc?: string
}

/**
 * Error codes the mail API can return beyond the generic `{code, message}`
 * shape — the UI renders these as specific states (a "reconnect" prompt, a
 * "try again shortly" notice) rather than a generic failure toast.
 */
export const MAIL_ERROR_CODES = {
  // Two distinct backend codes both mean "needs reconnecting": a dead Zoho
  // token (zoho_token_expired, from the API call itself) and a connection
  // already marked inactive before any call is even made (connection_inactive,
  // from Api::V1::Mail::BaseController#resolve_connection!). The UI treats
  // both as the same "reconnect" state — see isMailReauthError in api.ts.
  tokenExpired: "zoho_token_expired",
  connectionInactive: "connection_inactive",
  rateLimited: "zoho_rate_limited",
} as const

"use client"

import { useState } from "react"
import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useMailConnections, useConnectMailbox } from "@/features/mail/hooks/use-mail-connections"
import { useMailMessages, useMailSearch, useMailStats, useMarkMailRead } from "@/features/mail/hooks/use-mail-messages"
import { isMailReauthError, isMailRateLimitError } from "@/features/mail/api"
import { ConnectMailboxEmptyState } from "@/features/mail/components/connect-mailbox-empty-state"
import { MailSearchInput } from "@/features/mail/components/mail-search-input"
import { MessageList, MessageListSkeleton } from "@/features/mail/components/message-list"
import { MessageReadingPane } from "@/features/mail/components/message-reading-pane"
import { MailStatsOverview } from "@/features/mail/components/mail-stats-overview"
import { ComposeMailDialog } from "@/features/mail/components/compose-mail-dialog"
import { MailReauthAlert, MailRateLimitedAlert } from "@/features/mail/components/mail-status-alert"
import type { MailFolder, MailMessageDetail } from "@/types/mail"

function WorkspaceSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export function MailWorkspace() {
  const { data: connections, isLoading: connectionsLoading } = useMailConnections()
  const connectMailbox = useConnectMailbox()

  const [panelOpen, setPanelOpen] = useState(false)
  const [folder, setFolder] = useState<MailFolder>("inbox")
  const [folderId, setFolderId] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState<string | undefined>(undefined)
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)

  const [composeOpen, setComposeOpen] = useState(false)
  const [replyData, setReplyData] = useState<{ to: string; subject: string; body: string } | null>(null)

  const connection = connections?.[0]
  const isSearching = searchQuery !== undefined
  const { data: stats } = useMailStats(connection?.id)
  const folderQuery = useMailMessages({ connectionId: connection?.id, folder, folderId, page })
  const searchResults = useMailSearch({ connectionId: connection?.id, q: searchQuery ?? "", page })
  const active = isSearching ? searchResults : folderQuery

  const markReadMutation = useMarkMailRead()

  if (connectionsLoading) return <WorkspaceSkeleton />
  if (!connection) return <ConnectMailboxEmptyState />

  if (connection.status === "error") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <div className="w-full max-w-md">
          <MailReauthAlert onReconnect={() => connectMailbox.mutate("individual")} pending={connectMailbox.isPending} />
        </div>
      </div>
    )
  }

  function selectFolder(next: MailFolder, nextFolderId?: string, search?: string) {
    const resolvedFolderId = nextFolderId ?? stats?.folders?.find((f) => f.name.toLowerCase() === next.toLowerCase())?.id
    setFolder(next)
    setFolderId(resolvedFolderId)
    setSearchQuery(search)
    setPage(1)
    setSelectedId(undefined)
    setPanelOpen(true)
  }

  function handleSelectMessage(id: string) {
    setSelectedId(id)
    const clicked = active.data?.data?.find((m) => m.id === id)
    if (clicked && !clicked.isRead && connection?.id) {
      markReadMutation.mutate({ connectionId: connection.id, messageId: id, read: true })
    }
  }

  function handleReply(message: MailMessageDetail) {
    const rawBody = message.body ? message.body.replace(/<[^>]*>/g, "").trim() : ""
    setReplyData({
      to: message.from,
      subject: message.subject.startsWith("Re:") ? message.subject : `Re: ${message.subject}`,
      body: `\n\n\n--- Original Message ---\nFrom: ${message.from}\nDate: ${new Date(message.receivedAt).toLocaleString()}\n\n${rawBody}`,
    })
    setComposeOpen(true)
  }

  return (
    <div className="min-w-0 space-y-4">
      <MailStatsOverview
        connectionId={connection.id}
        emailAddress={connection.emailAddress}
        onCompose={() => {
          setReplyData(null)
          setComposeOpen(true)
        }}
        onSelectFolder={selectFolder}
      />

      {/* Inline message panel — expands below the dashboard instead of
          replacing it or navigating to a separate screen. Selecting a
          different card/folder above just swaps which folder this shows. */}
      {panelOpen && (
        <div className="flex h-[70vh] min-h-115 flex-col overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-center gap-2 border-b p-3">
            <div className="flex-1 min-w-0">
              <MailSearchInput
                onSearch={(q) => {
                  setSearchQuery(q)
                  setPage(1)
                  setSelectedId(undefined)
                }}
                onClear={() => {
                  setSearchQuery(undefined)
                  setPage(1)
                }}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPanelOpen(false)}
              aria-label="Close"
              className="shrink-0"
            >
              <XIcon className="size-4" />
            </Button>
          </div>

          <div className="min-h-0 flex-1">
            {active.isLoading ? (
              <MessageListSkeleton />
            ) : active.isError && isMailReauthError(active.error) ? (
              <div className="p-4">
                <MailReauthAlert onReconnect={() => connectMailbox.mutate("individual")} pending={connectMailbox.isPending} />
              </div>
            ) : active.isError && isMailRateLimitError(active.error) ? (
              <div className="p-4">
                <MailRateLimitedAlert />
              </div>
            ) : (
              <MessageList
                messages={active.data?.data ?? []}
                meta={active.data?.meta}
                selectedId={selectedId}
                onSelect={handleSelectMessage}
                onPageChange={setPage}
                emptyLabel={isSearching ? "No messages match your search." : "No messages in this folder."}
              />
            )}
          </div>
        </div>
      )}

      {/* Email detail modal */}
      <Dialog
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(undefined)
        }}
      >
        <DialogContent className="sm:max-w-3xl md:max-w-4xl h-[85vh] max-h-[85vh] p-0 flex flex-col gap-0 overflow-hidden">
          <MessageReadingPane
            connectionId={connection.id}
            messageId={selectedId}
            onBack={() => setSelectedId(undefined)}
            onReply={handleReply}
            onDeleted={() => setSelectedId(undefined)}
          />
        </DialogContent>
      </Dialog>

      {/* Compose & Send Email Dialog */}
      <ComposeMailDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        connectionId={connection.id}
        defaultTo={replyData?.to || ""}
        defaultSubject={replyData?.subject || ""}
        defaultBody={replyData?.body || ""}
      />
    </div>
  )
}

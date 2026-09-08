"use client"

import { useState } from "react"
import { InboxIcon, LayoutDashboardIcon, PenSquareIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useMailConnections, useConnectMailbox } from "@/features/mail/hooks/use-mail-connections"
import { useMailMessages, useMailSearch, useMailStats, useMarkMailRead } from "@/features/mail/hooks/use-mail-messages"
import { isMailReauthError, isMailRateLimitError } from "@/features/mail/api"
import { ConnectMailboxEmptyState } from "@/features/mail/components/connect-mailbox-empty-state"
import { FolderNav } from "@/features/mail/components/folder-nav"
import { MailSearchInput } from "@/features/mail/components/mail-search-input"
import { MessageList, MessageListSkeleton } from "@/features/mail/components/message-list"
import { MessageReadingPane } from "@/features/mail/components/message-reading-pane"
import { MailStatsOverview } from "@/features/mail/components/mail-stats-overview"
import { ComposeMailDialog } from "@/features/mail/components/compose-mail-dialog"
import { MailReauthAlert, MailRateLimitedAlert } from "@/features/mail/components/mail-status-alert"
import type { MailFolder, MailMessageDetail } from "@/types/mail"

function WorkspaceSkeleton() {
  return (
    <div className="grid h-[75vh] min-h-135 grid-cols-[200px_1fr] gap-0 overflow-hidden rounded-2xl border">
      <div className="grid gap-1 border-r p-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
      <MessageListSkeleton />
    </div>
  )
}

export function MailWorkspace() {
  const { data: connections, isLoading: connectionsLoading } = useMailConnections()
  const connectMailbox = useConnectMailbox()

  const [activeTab, setActiveTab] = useState<"dashboard" | "mailbox">("dashboard")
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
    setActiveTab("mailbox")
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

  const unreadFolderCounts: Record<string, number> = {
    inbox: stats?.inboxUnread ?? 0,
    sent: 0,
    drafts: stats?.draftsCount ?? 0,
    spam: stats?.spamCount ?? 0,
    trash: stats?.trashCount ?? 0,
  }

  if (stats?.folders) {
    for (const f of stats.folders) {
      unreadFolderCounts[f.name.toLowerCase()] = f.unreadCount
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Header Navigation Tabs & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1 w-fit border">
          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              activeTab === "dashboard"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutDashboardIcon className="size-3.5" />
            <span>Dashboard & Stats</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("mailbox")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              activeTab === "mailbox"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <InboxIcon className="size-3.5" />
            <span>Mailbox</span>
            {stats?.inboxUnread !== undefined && stats.inboxUnread > 0 && (
              <span className="rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-bold leading-none">
                {stats.inboxUnread}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setReplyData(null)
              setComposeOpen(true)
            }}
            className="gap-1.5 text-xs shadow-xs"
          >
            <PenSquareIcon className="size-3.5" />
            Compose
          </Button>
        </div>
      </div>

      {activeTab === "dashboard" ? (
        <MailStatsOverview
          connectionId={connection.id}
          emailAddress={connection.emailAddress}
          onCompose={() => {
            setReplyData(null)
            setComposeOpen(true)
          }}
          onSelectFolder={selectFolder}
        />
      ) : (
        /* Mailbox workspace */
        <div className="flex h-[75vh] min-h-135 flex-col overflow-hidden rounded-2xl border bg-card md:flex-row">
          {/* Sidebar folder navigation */}
          <div className="flex shrink-0 flex-col border-b md:w-52 lg:w-56 md:border-b-0 md:border-r">
            <FolderNav
              active={folder}
              onSelect={selectFolder}
              unreadCounts={unreadFolderCounts}
              allFolders={stats?.folders}
            />
          </div>

          {/* Full-width messages view */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="border-b p-3">
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

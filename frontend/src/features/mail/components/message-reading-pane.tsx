"use client"

import { useState, useEffect } from "react"
import {
  ArrowLeftIcon,
  DownloadIcon,
  FileTextIcon,
  MailOpenIcon,
  MailIcon,
  PaperclipIcon,
  Trash2Icon,
  ReplyIcon,
  AlertCircleIcon,
  RefreshCwIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useMailMessage, useMarkMailRead, useDeleteMailMessage } from "@/features/mail/hooks/use-mail-messages"
import { mailApi } from "@/features/mail/api"
import type { MailAttachment, MailMessageDetail } from "@/types/mail"

function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MessageReadingPane({
  connectionId,
  messageId,
  onBack,
  onReply,
  onDeleted,
}: {
  connectionId: string | undefined
  messageId: string | undefined
  onBack?: () => void
  onReply?: (message: MailMessageDetail) => void
  onDeleted?: () => void
}) {
  const { data: message, isLoading, isError, refetch } = useMailMessage({ connectionId, id: messageId })
  const markReadMutation = useMarkMailRead()
  const deleteMutation = useDeleteMailMessage()
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // Auto mark message as read when opened
  useEffect(() => {
    if (connectionId && message?.id && !message.isRead) {
      markReadMutation.mutate({ connectionId, messageId: message.id, read: true })
    }
  }, [connectionId, message?.id, message?.isRead])

  async function handleDownload(att: MailAttachment) {
    if (!connectionId || !message) return
    try {
      setDownloadingId(att.id)
      const url = mailApi.messages.attachmentUrl(connectionId, message.id, att.id)
      const res = await fetch(url, { credentials: "include" })
      if (!res.ok) throw new Error(`Download failed with status ${res.status}`)
      const blob = await res.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = att.name
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000)
    } catch (err) {
      console.error("Attachment download failed, falling back to window.open:", err)
      window.open(mailApi.messages.attachmentUrl(connectionId, message.id, att.id), "_blank")
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleDelete() {
    if (!connectionId || !message) return
    if (!confirm("Are you sure you want to delete this email?")) return

    try {
      await deleteMutation.mutateAsync({ connectionId, messageId: message.id })
      toast.success("Email deleted")
      onDeleted?.()
      onBack?.()
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete email")
    }
  }

  if (!messageId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
        <MailOpenIcon className="size-8 text-muted-foreground/50" />
        <p className="text-sm">Select a message to read it here.</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center gap-3">
        <AlertCircleIcon className="size-8 text-destructive" />
        <p className="text-sm font-semibold">Failed to load email</p>
        <p className="text-xs text-muted-foreground max-w-sm">
          Could not fetch email content from Zoho Mail. Please retry or check your connection.
        </p>
        <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1.5 text-xs">
          <RefreshCwIcon className="size-3.5" />
          Retry
        </Button>
      </div>
    )
  }

  if (isLoading || !message) {
    return (
      <div className="flex h-full flex-col p-6">
        <div className="space-y-2 pr-8">
          <Skeleton className="h-6 w-3/4" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/4" />
          </div>
        </div>
        <div className="mt-8 flex-1 space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="border-b p-5 pr-12 bg-muted/15 shrink-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          {onBack && (
            <Button variant="ghost" size="sm" className="mb-1 -ml-2 md:hidden" onClick={onBack}>
              <ArrowLeftIcon className="size-4" /> Back
            </Button>
          )}

          {/* Quick Actions Bar */}
          <div className="flex items-center gap-1 ml-auto">
            {onReply && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onReply(message)}
                className="gap-1 text-xs"
                title="Reply to email"
              >
                <ReplyIcon className="size-3.5" />
                <span>Reply</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                if (!connectionId) return
                markReadMutation.mutate({
                  connectionId,
                  messageId: message.id,
                  read: !message.isRead,
                })
              }}
              className="gap-1 text-xs"
              title={message.isRead ? "Mark as unread" : "Mark as read"}
            >
              {message.isRead ? (
                <>
                  <MailIcon className="size-3.5" />
                  <span>Mark unread</span>
                </>
              ) : (
                <>
                  <MailOpenIcon className="size-3.5" />
                  <span>Mark read</span>
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              size="xs"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="gap-1 text-xs text-destructive hover:bg-destructive/10"
              title="Delete email"
            >
              <Trash2Icon className="size-3.5" />
              <span>Delete</span>
            </Button>
          </div>
        </div>

        <DialogHeader className="gap-1.5 text-left">
          <DialogTitle className="text-lg font-semibold leading-snug break-words">
            {message.subject || "(no subject)"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
            <span className="font-semibold text-foreground">{message.from}</span>
            <span className="text-muted-foreground/60">•</span>
            <span>to {message.to}</span>
            <span className="text-muted-foreground/60">•</span>
            <span>{new Date(message.receivedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
            {message.attachments && message.attachments.length > 0 && (
              <>
                <span className="text-muted-foreground/60">•</span>
                <span className="inline-flex items-center gap-1 font-medium text-foreground/90">
                  <PaperclipIcon className="size-3" />
                  {message.attachments.length} {message.attachments.length === 1 ? "attachment" : "attachments"}
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-6 min-h-0 bg-background">
        {/<[a-z][\s\S]*>/i.test(message.body) ? (
          <div
            className="text-sm leading-relaxed break-words font-sans max-w-none [&_a]:text-primary [&_a]:underline [&_table]:max-w-full [&_img]:max-w-full [&_img]:h-auto"
            dangerouslySetInnerHTML={{ __html: message.body }}
          />
        ) : (
          <div className="whitespace-pre-wrap text-sm leading-relaxed break-words font-sans text-foreground/90">
            {message.body}
          </div>
        )}
      </div>

      {/* Attachments Section - Down at bottom of modal */}
      {message.attachments && message.attachments.length > 0 && (
        <div className="border-t bg-muted/20 px-5 py-3 shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            <PaperclipIcon className="size-3.5" />
            <span>
              {message.attachments.length} {message.attachments.length === 1 ? "Attachment" : "Attachments"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2.5 max-h-36 overflow-y-auto">
            {message.attachments.map((att) => (
              <div
                key={att.id}
                onClick={() => handleDownload(att)}
                className="group flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-xs shadow-2xs hover:border-primary/40 hover:bg-muted/40 transition-colors max-w-xs sm:max-w-sm cursor-pointer"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <FileTextIcon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground text-xs" title={att.name}>
                    {att.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{formatBytes(att.size)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 group-hover:text-primary"
                  title={`Download ${att.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDownload(att)
                  }}
                  disabled={downloadingId === att.id}
                >
                  {downloadingId === att.id ? (
                    <span className="size-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : (
                    <DownloadIcon className="size-3.5" />
                  )}
                  <span className="sr-only">Download</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

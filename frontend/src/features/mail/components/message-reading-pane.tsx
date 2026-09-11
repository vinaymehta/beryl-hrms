"use client"

import { useState, useEffect } from "react"
import {
  ArrowLeftIcon,
  DownloadIcon,
  FileTextIcon,
  MailOpenIcon,
  MailIcon,
  PaperclipIcon,
  AlertCircleIcon,
  RefreshCwIcon,
  SparklesIcon,
  Loader2Icon,
  SendIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useMailMessage, useMarkMailRead, useSendMailMessage } from "@/features/mail/hooks/use-mail-messages"
import { mailApi } from "@/features/mail/api"
import { recruitmentApi } from "@/features/recruitment/api"
import type { MailAttachment, MailMessageSummary } from "@/types/mail"

function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MessageReadingPane({
  connectionId,
  messageId,
  listSummary,
  onBack,
}: {
  connectionId: string | undefined
  messageId: string | undefined
  /** The exact row the user clicked from the message list — its from/to/
   *  subject/folderId are known-correct and passed through to the detail
   *  fetch, working around Zoho's unreliable message-by-id header lookup
   *  (see messages_controller#show). */
  listSummary?: MailMessageSummary
  onBack?: () => void
}) {
  const { data: message, isLoading, isError, refetch } = useMailMessage({
    connectionId,
    id: messageId,
    folderId: listSummary?.folderId,
    from: listSummary?.from,
    to: listSummary?.to,
    subject: listSummary?.subject,
  })
  const markReadMutation = useMarkMailRead()
  const sendMutation = useSendMailMessage()
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [importingId, setImportingId] = useState<string | null>(null)
  const [quickReply, setQuickReply] = useState("")
  const [replyCc, setReplyCc] = useState("")
  const [replyBcc, setReplyBcc] = useState("")
  const [showCcBcc, setShowCcBcc] = useState(false)
  // Reset the reply draft whenever a different message is opened — adjusted
  // during render (not an effect) per React's "resetting state when a prop
  // changes" pattern, avoiding an extra render pass.
  const [quickReplyMessageId, setQuickReplyMessageId] = useState(messageId)
  if (messageId !== quickReplyMessageId) {
    setQuickReplyMessageId(messageId)
    setQuickReply("")
    setReplyCc("")
    setReplyBcc("")
    setShowCcBcc(false)
  }

  // Auto mark message as read when opened
  useEffect(() => {
    if (connectionId && message?.id && !message.isRead) {
      markReadMutation.mutate({ connectionId, messageId: message.id, read: true })
    }
  }, [connectionId, message?.id, message?.isRead])

  function isResumeAttachment(fileName: string) {
    const lower = fileName.toLowerCase()
    return (
      lower.endsWith(".pdf") ||
      lower.endsWith(".docx") ||
      lower.endsWith(".doc") ||
      lower.includes("resume") ||
      lower.includes("cv")
    )
  }

  async function handleImportResume(att: MailAttachment, e: React.MouseEvent) {
    e.stopPropagation()
    if (!connectionId || !message) return

    setImportingId(att.id)
    try {
      await recruitmentApi.resumes.importFromZoho({
        connectionId,
        messageId: message.id,
        attachmentId: att.id,
        fileName: att.name,
      })
      toast.success(`"${att.name}" sent to Recruitment AI processing pipeline!`)
    } catch (err: any) {
      toast.error(err?.message || "Failed to import resume")
    } finally {
      setImportingId(null)
    }
  }

  async function handleDownloadAll() {
    if (!connectionId || !message || !message.attachments) return
    setDownloadingAll(true)
    try {
      for (const att of message.attachments) {
        await handleDownload(att)
      }
      toast.success("Downloaded all attachments")
    } catch (err) {
      toast.error("Failed downloading all attachments")
    } finally {
      setDownloadingAll(false)
    }
  }

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

  async function handleQuickReply() {
    if (!connectionId || !message || !quickReply.trim()) return
    try {
      await sendMutation.mutateAsync({
        connectionId,
        to: message.from,
        subject: message.subject.startsWith("Re:") ? message.subject : `Re: ${message.subject}`,
        body: quickReply.trim(),
        ...(replyCc.trim() ? { cc: replyCc.trim() } : {}),
        ...(replyBcc.trim() ? { bcc: replyBcc.trim() } : {}),
      })
      toast.success("Reply sent")
      setQuickReply("")
      setReplyCc("")
      setReplyBcc("")
    } catch (err: any) {
      toast.error(err?.message || "Failed to send reply")
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

  const hasResumeAttachment = message.attachments?.some((a) => isResumeAttachment(a.name)) ?? false

  return (
    <div className="flex h-full flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="border-b p-5 pr-14 bg-muted/15 shrink-0">
        {onBack && (
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 md:hidden" onClick={onBack}>
            <ArrowLeftIcon className="size-4" /> Back
          </Button>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-mail/12 text-accent-mail">
              <MailIcon className="size-5" />
            </span>
            <div className="min-w-0 flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold leading-snug break-words text-foreground">
                  {message.subject || "(no subject)"}
                </h3>
                {hasResumeAttachment && (
                  <span className="inline-flex items-center rounded-full bg-role-recruitment/12 px-2 py-0.5 text-[11px] font-semibold text-role-recruitment shrink-0">
                    Recruitment
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
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
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              if (!connectionId) return
              markReadMutation.mutate({ connectionId, messageId: message.id, read: !message.isRead })
            }}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            title={message.isRead ? "Mark as unread" : "Mark as read"}
          >
            {message.isRead ? <MailIcon className="size-4" /> : <MailOpenIcon className="size-4" />}
            <span className="sr-only">{message.isRead ? "Mark unread" : "Mark read"}</span>
          </Button>
        </div>
      </div>

      {/* Body — 60% message content / 40% reply, stacked vertically */}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
        {/* Top section (60%) — message content + attachments */}
        <div className="h-3/5 min-h-0 overflow-y-auto border-b bg-muted/10 p-5 sm:p-6">
          <div className="rounded-xl border bg-card p-5 shadow-2xs">
            {/<[a-z][\s\S]*>/i.test(message.body) ? (
              // Real emails routinely include <ul>/<ol>/<blockquote>/<h1-6>
              // — but Tailwind's global Preflight reset (list-style: none,
              // margin/padding: 0 on those exact tags) applies here too,
              // since this injected HTML isn't isolated in an iframe. Left
              // alone, a bulleted list from the original email would render
              // with no bullets or indentation at all — formatting that's
              // fully intact when the same message is opened in Zoho's own
              // webmail. These utilities restore just enough of the default
              // browser look for this content specifically.
              <div
                className="text-sm leading-relaxed break-words font-sans max-w-none text-foreground/90 [&_a]:text-accent-mail [&_a]:underline [&_table]:max-w-full [&_img]:max-w-full [&_img]:h-auto [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_h1]:my-2 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:my-2 [&_h2]:text-base [&_h2]:font-bold [&_h3]:my-1.5 [&_h3]:text-sm [&_h3]:font-bold [&_hr]:my-3 [&_hr]:border-border"
                dangerouslySetInnerHTML={{ __html: message.body }}
              />
            ) : (
              <div className="whitespace-pre-wrap text-sm leading-relaxed break-words font-sans text-foreground/90">
                {message.body}
              </div>
            )}
          </div>

          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-4 rounded-xl border bg-card p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <PaperclipIcon className="size-3.5" />
                  <span>
                    {message.attachments.length} {message.attachments.length === 1 ? "Attachment" : "Attachments"}
                  </span>
                </div>

                {message.attachments.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadAll}
                    disabled={downloadingAll}
                    className="h-6 text-[11px] text-muted-foreground hover:text-foreground gap-1 px-2"
                  >
                    {downloadingAll ? (
                      <Loader2Icon className="size-3 animate-spin" />
                    ) : (
                      <DownloadIcon className="size-3" />
                    )}
                    Download all
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap gap-2.5">
                {message.attachments.map((att) => {
                  const isResume = isResumeAttachment(att.name)
                  const isImporting = importingId === att.id

                  return (
                    <div
                      key={att.id}
                      onClick={() => handleDownload(att)}
                      className={`group flex items-center gap-3 rounded-lg border bg-background px-3 py-2 text-xs shadow-2xs hover:border-accent-mail/40 hover:bg-muted/40 transition-colors max-w-xs sm:max-w-sm cursor-pointer ${
                        isResume ? "border-pink-500/30" : ""
                      }`}
                    >
                      <div
                        className={`flex size-8 shrink-0 items-center justify-center rounded-md ${
                          isResume
                            ? "bg-pink-500/10 text-pink-600 dark:text-pink-400"
                            : "bg-accent-mail/10 text-accent-mail"
                        }`}
                      >
                        <FileTextIcon className="size-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground text-xs" title={att.name}>
                          {att.name}
                        </p>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span>{formatBytes(att.size)}</span>
                          {isResume && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-pink-600 dark:text-pink-400">
                              • Resume/CV
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isResume && (
                          <Button
                            variant="outline"
                            size="icon-xs"
                            className="shrink-0 border-pink-500/30 text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/20"
                            title="Send to Recruitment AI pipeline"
                            onClick={(e) => handleImportResume(att, e)}
                            disabled={isImporting}
                          >
                            {isImporting ? (
                              <Loader2Icon className="size-3 animate-spin text-pink-600" />
                            ) : (
                              <SparklesIcon className="size-3 text-pink-600" />
                            )}
                            <span className="sr-only">Send to Recruitment</span>
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="shrink-0 group-hover:text-accent-mail"
                          title={`Download ${att.name}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDownload(att)
                          }}
                          disabled={downloadingId === att.id}
                        >
                          {downloadingId === att.id ? (
                            <span className="size-3 animate-spin rounded-full border-2 border-accent-mail border-t-transparent" />
                          ) : (
                            <DownloadIcon className="size-3.5" />
                          )}
                          <span className="sr-only">Download</span>
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom section (40%) — reply composer, the only way to reply now */}
        <div className="h-2/5 min-h-0 flex flex-col bg-background">
          <div className="border-b bg-muted/15 px-4 py-3 shrink-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reply</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-10 shrink-0 text-muted-foreground">To</span>
              <span className="min-w-0 flex-1 truncate rounded-md border bg-muted/30 px-2 py-1 text-foreground">
                {message.from}
              </span>
              <button
                type="button"
                onClick={() => setShowCcBcc(!showCcBcc)}
                className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  showCcBcc ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                Cc/Bcc
              </button>
            </div>
            {showCcBcc && (
              <>
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-10 shrink-0 text-muted-foreground">Cc</span>
                  <Input
                    value={replyCc}
                    onChange={(e) => setReplyCc(e.target.value)}
                    placeholder="Cc recipients"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-10 shrink-0 text-muted-foreground">Bcc</span>
                  <Input
                    value={replyBcc}
                    onChange={(e) => setReplyBcc(e.target.value)}
                    placeholder="Bcc recipients"
                    className="h-8 text-xs"
                  />
                </div>
              </>
            )}
            <textarea
              value={quickReply}
              onChange={(e) => setQuickReply(e.target.value)}
              placeholder={`Write a reply to ${message.from}...`}
              className="mt-1 h-full min-h-40 w-full resize-none rounded-lg border border-input bg-background p-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <div className="flex items-center justify-end border-t bg-muted/10 p-3 shrink-0">
            <Button
              size="sm"
              onClick={handleQuickReply}
              disabled={!quickReply.trim() || sendMutation.isPending}
              className="gap-1.5"
            >
              {sendMutation.isPending ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <SendIcon className="size-3.5" />
              )}
              Reply
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

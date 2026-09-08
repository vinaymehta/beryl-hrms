"use client"

import { InboxIcon, PaperclipIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { MailMessageSummary } from "@/types/mail"
import type { PaginationMeta } from "@/types/api"

export function MessageListSkeleton() {
  return (
    <div className="grid gap-2 p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="grid gap-1.5 rounded-lg p-2.5">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  )
}

export function MessageList({
  messages,
  selectedId,
  onSelect,
  meta,
  onPageChange,
  emptyLabel,
}: {
  messages: MailMessageSummary[]
  selectedId: string | undefined
  onSelect: (id: string) => void
  meta: PaginationMeta | undefined
  onPageChange: (page: number) => void
  emptyLabel: string
}) {
  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <InboxIcon className="size-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {messages.map((message) => (
          <li key={message.id}>
            <button
              type="button"
              onClick={() => onSelect(message.id)}
              className={cn(
                "group flex w-full flex-col gap-1 border-b px-4 py-3 text-left transition-colors cursor-pointer",
                selectedId === message.id ? "bg-primary/10" : "hover:bg-muted/60"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={cn(
                    "truncate text-sm",
                    !message.isRead ? "font-semibold text-foreground" : "font-normal text-foreground/90"
                  )}
                >
                  {message.from}
                </span>
                <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {message.hasAttachment && (
                    <span title="Has attachment" className="flex items-center text-muted-foreground/80">
                      <PaperclipIcon className="size-3.5" />
                    </span>
                  )}
                  <span>
                    {new Date(message.receivedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
              <div className="flex items-baseline gap-2 truncate">
                <span
                  className={cn(
                    "text-sm shrink-0 max-w-[50%] truncate",
                    !message.isRead ? "font-semibold text-foreground" : "font-medium text-foreground/85"
                  )}
                >
                  {message.subject || "(no subject)"}
                </span>
                {message.snippet && (
                  <span className="truncate text-xs text-muted-foreground">
                    — {message.snippet}
                  </span>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={meta.page <= 1}
            onClick={() => onPageChange(meta.page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            {meta.page} / {meta.totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={meta.page >= meta.totalPages}
            onClick={() => onPageChange(meta.page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}

"use client"

import { InboxIcon, PaperclipIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { MailMessageSummary } from "@/types/mail"
import type { PaginationMeta } from "@/types/api"

// Hard character cap on top of CSS truncation — a snippet with no spaces
// (a long URL, a run-on line) can't be broken by text-overflow alone, so
// clamp the string itself before it ever reaches the DOM.
function clampText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength).trimEnd()}…`
}

function initialsFromFrom(from: string): string {
  const nameOnly = (from.match(/^([^<]+)</)?.[1] ?? from).trim()
  const parts = nameOnly.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase()
  return "?"
}

// -600 (not -500) shades so white initials keep AA contrast (4.5:1+) on every color.
const AVATAR_COLORS = [
  "bg-rose-600",
  "bg-purple-600",
  "bg-blue-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-cyan-600",
  "bg-pink-600",
  "bg-indigo-600",
]

// Deterministic per-sender color so the same person always gets the same
// avatar color across renders/pages, without needing to store one.
function avatarColorFor(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

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
  checkedIds,
  onToggleChecked,
}: {
  messages: MailMessageSummary[]
  selectedId: string | undefined
  onSelect: (id: string) => void
  meta: PaginationMeta | undefined
  onPageChange: (page: number) => void
  emptyLabel: string
  checkedIds?: Set<string>
  onToggleChecked?: (id: string) => void
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
            <div
              className={cn(
                "group flex w-full items-start gap-3 border-b px-6 py-3 transition-colors",
                selectedId === message.id ? "bg-accent-mail/10" : "hover:bg-muted/60"
              )}
            >
              {onToggleChecked && (
                <input
                  type="checkbox"
                  checked={checkedIds?.has(message.id) ?? false}
                  onChange={() => onToggleChecked(message.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 size-4 shrink-0 cursor-pointer accent-accent-mail"
                  aria-label={`Select email from ${message.from}`}
                />
              )}
              <span
                className={cn(
                  "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
                  avatarColorFor(message.from)
                )}
              >
                {initialsFromFrom(message.from)}
              </span>
              <button
                type="button"
                onClick={() => onSelect(message.id)}
                className="flex min-w-0 flex-1 flex-col gap-1 text-left cursor-pointer"
              >
              <div className="flex items-center justify-between gap-3 min-w-0">
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    !message.isRead ? "font-semibold text-foreground" : "font-normal text-foreground/90"
                  )}
                >
                  {clampText(message.from, 50)}
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
              <div className="flex items-baseline gap-2 min-w-0">
                <span
                  className={cn(
                    "text-sm shrink-0 max-w-[50%] truncate",
                    !message.isRead ? "font-semibold text-foreground" : "font-medium text-foreground/85"
                  )}
                >
                  {clampText(message.subject || "(no subject)", 60)}
                </span>
                {message.snippet && (
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    — {clampText(message.snippet, 100)}
                  </span>
                )}
              </div>
              </button>
            </div>
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

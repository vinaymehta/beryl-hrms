"use client"

import { useState } from "react"
import Link from "next/link"
import {
  AlertTriangleIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  InboxIcon,
  PaperclipIcon,
  SendIcon,
  StarIcon,
} from "lucide-react"
import { useResumeEmailMessage, useResumeEmails } from "../hooks"
import { Skeleton } from "@/components/ui/skeleton"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@/constants/permissions"
import { cn } from "cn"
import { errorMessage } from "@/lib/errors"
import type { CandidateEmailItem } from "@/types/recruitment"

// Same restorations of list/heading/quote styling the Mail reading pane
// applies to injected email HTML (see message-reading-pane.tsx for why
// Tailwind's Preflight needs undoing here).
const EMAIL_HTML_CLASSES =
  "text-xs leading-relaxed break-words font-sans max-w-none text-foreground/90 [&_a]:text-accent-mail [&_a]:underline [&_table]:max-w-full [&_img]:max-w-full [&_img]:h-auto [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_hr]:my-3 [&_hr]:border-border"

function itemKey(item: CandidateEmailItem) {
  return `${item.source}:${item.connectionId ?? ""}:${item.id}`
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

// Three kinds of entry, told apart at a glance: mail the candidate sent us,
// mail we sent from a Zoho mailbox, and mail the app sent on its own (booking
// links, interview packets — these are in no mailbox at all).
function directionStyle(item: CandidateEmailItem) {
  if (item.source === "app") {
    return { icon: SendIcon, label: "Sent by HRMS", className: "bg-role-recruitment/10 text-role-recruitment" }
  }
  return item.direction === "sent"
    ? { icon: ArrowUpRightIcon, label: "Sent", className: "bg-blue-500/10 text-blue-600" }
    : { icon: ArrowDownLeftIcon, label: "Received", className: "bg-emerald-500/10 text-emerald-600" }
}

/**
 * The resume panel's Emails tab — one newest-first timeline of everything
 * exchanged with this candidate across the connected Zoho mailboxes, merged
 * with the recruitment mail the app sent about them. Entries expand in place;
 * a Zoho message's full body is fetched only then.
 */
export function ResumeEmailsTab({ resumeId }: { resumeId: string }) {
  const { data, isLoading, isError, error } = useResumeEmails(resumeId)
  const canOpenMail = usePermission(PERMISSIONS.mailView)
  const [expanded, setExpanded] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3 rounded-lg border p-3">
            <Skeleton className="size-7 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (isError || !data) {
    return <p className="text-destructive">{errorMessage(error, "Couldn't load the emails for this candidate.")}</p>
  }

  const troubled = data.accounts.filter((a) => a.status !== "ok")

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground">
          {data.candidateEmail ? (
            <>
              Conversation with <span className="font-medium text-foreground">{data.candidateEmail}</span>
            </>
          ) : (
            "No email address on this resume yet"
          )}
        </p>
        {canOpenMail && (
          <Link
            href="/mail"
            className="inline-flex items-center gap-1 text-xs font-medium text-role-recruitment hover:underline"
          >
            <ExternalLinkIcon className="size-3.5" />
            Open in Mail
          </Link>
        )}
      </div>

      {troubled.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-700 dark:text-amber-400 flex items-start gap-2">
          <AlertTriangleIcon className="size-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold">Some mailboxes weren&apos;t searched</p>
            {troubled.map((a) => (
              <p key={a.connectionId} className="text-[11px] leading-relaxed">
                {a.email} — {a.status === "reconnect_required" ? "needs to be reconnected in Mail" : a.error || "unavailable"}
              </p>
            ))}
          </div>
        </div>
      )}

      {data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <InboxIcon className="size-6" />
          <p>
            {data.candidateEmail
              ? `No emails with ${data.candidateEmail} yet.`
              : "Once the candidate's address is known, emails with them will appear here."}
          </p>
          {data.accounts.length === 0 && <p className="text-[11px]">No mailbox is connected, so only mail sent by HRMS can appear.</p>}
        </div>
      ) : (
        <ul className="space-y-2">
          {data.items.map((item) => {
            const key = itemKey(item)
            return (
              <EmailEntry
                key={key}
                resumeId={resumeId}
                item={item}
                open={expanded === key}
                onToggle={() => setExpanded((cur) => (cur === key ? null : key))}
              />
            )
          })}
        </ul>
      )}
    </div>
  )
}

function EmailEntry({
  resumeId,
  item,
  open,
  onToggle,
}: {
  resumeId: string
  item: CandidateEmailItem
  open: boolean
  onToggle: () => void
}) {
  const style = directionStyle(item)
  const Icon = style.icon
  const resumeAttached = item.source === "app" && (item.attachmentNames?.length ?? 0) > 0

  return (
    <li className={cn("rounded-lg border bg-card transition-colors", open && "border-role-recruitment/40")}>
      <button onClick={onToggle} className="flex w-full items-start gap-3 p-3 text-left hover:bg-muted/40 rounded-lg">
        <span
          className={cn("mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full", style.className)}
          title={style.label}
        >
          <Icon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-semibold text-foreground">{item.subject}</p>
            <span className="shrink-0 text-[11px] text-muted-foreground">{formatDate(item.date)}</span>
          </div>
          <p className="truncate text-[11px] text-muted-foreground">
            {item.from} → {item.to}
          </p>
          {!open && item.snippet && <p className="line-clamp-2 text-muted-foreground">{item.snippet}</p>}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", style.className)}>{style.label}</span>
            {item.source === "zoho" && item.accountEmail && (
              <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                {item.accountEmail}
                {item.folder ? ` · ${item.folder}` : ""}
              </span>
            )}
            {item.isOriginalApplication && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                <StarIcon className="size-2.5" />
                Original application
              </span>
            )}
            {resumeAttached ? (
              <span
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                title={item.attachmentNames?.join(", ")}
              >
                <PaperclipIcon className="size-3" />
                Resume attached
              </span>
            ) : (
              item.hasAttachments && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <PaperclipIcon className="size-3" />
                  Attachments
                </span>
              )
            )}
          </div>
        </div>
        <ChevronDownIcon
          className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="border-t bg-muted/10 p-4">
          {item.source === "app" ? (
            <div className="whitespace-pre-wrap break-words leading-relaxed text-foreground/90">
              {item.body || "(no text content)"}
            </div>
          ) : (
            <ZohoMessageBody resumeId={resumeId} item={item} />
          )}
        </div>
      )}
    </li>
  )
}

// Mounted only while its entry is expanded, so a body is fetched on demand.
function ZohoMessageBody({ resumeId, item }: { resumeId: string; item: CandidateEmailItem }) {
  const { data, isLoading, isError, error } = useResumeEmailMessage(resumeId, item.id, item.connectionId)

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    )
  }
  if (isError || !data) {
    return <p className="text-destructive">{errorMessage(error, "Couldn't load this message.")}</p>
  }

  return (
    <div className="space-y-3">
      {/<[a-z][\s\S]*>/i.test(data.body) ? (
        // Sanitized by the backend (ResumeEmailsController#show) before it
        // gets here.
        <div className={EMAIL_HTML_CLASSES} dangerouslySetInnerHTML={{ __html: data.body }} />
      ) : (
        <div className="whitespace-pre-wrap break-words leading-relaxed text-foreground/90">
          {data.body || "(no text content)"}
        </div>
      )}
      {data.attachments && data.attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.attachments.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              <PaperclipIcon className="size-3" />
              {a.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

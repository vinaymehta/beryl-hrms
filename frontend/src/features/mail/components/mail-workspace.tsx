"use client"

import { useEffect, useRef, useState } from "react"
import {
  MailIcon,
  InboxIcon,
  SendIcon,
  LayersIcon,
  AlertCircleIcon,
  RefreshCwIcon,
  PenSquareIcon,
  CheckCircle2Icon,
  MailCheckIcon,
  Trash2Icon,
  XIcon,
  FilterIcon,
  type LucideIcon,
} from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useMailConnections, useConnectMailbox } from "@/features/mail/hooks/use-mail-connections"
import { useMailMessages, useMailSearch, useMailStats, useMarkMailRead, useDeleteMailMessage } from "@/features/mail/hooks/use-mail-messages"
import { isMailReauthError, isMailRateLimitError, mailApi } from "@/features/mail/api"
import { ConnectMailboxEmptyState } from "@/features/mail/components/connect-mailbox-empty-state"
import { FolderNav } from "@/features/mail/components/folder-nav"
import { MessageList, MessageListSkeleton } from "@/features/mail/components/message-list"
import { MessageReadingPane } from "@/features/mail/components/message-reading-pane"
import { ComposeMailDialog } from "@/features/mail/components/compose-mail-dialog"
import { MailReauthAlert, MailRateLimitedAlert } from "@/features/mail/components/mail-status-alert"
import { MailDateFilter } from "@/features/mail/components/mail-date-filter"
import {
  DEFAULT_MAIL_DATE_RANGE_PRESET,
  MAIL_DATE_RANGE_PRESETS,
  resolveMailDateRange,
  type MailDateRange,
  type MailDateRangePreset,
} from "@/features/mail/lib/mail-date-ranges"
import type { MailFolder, MailMessageSummary } from "@/types/mail"

const PANE_HEIGHT = "h-[75vh] min-h-135"

function WorkspaceSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-5">
        <Skeleton className={`${PANE_HEIGHT} w-full rounded-xl lg:col-span-1`} />
        <Skeleton className={`${PANE_HEIGHT} w-full rounded-xl lg:col-span-4`} />
      </div>
    </div>
  )
}

interface Kpi {
  key: string
  label: string
  value: number | undefined
  /** True when value is a lower bound, not an exact count — rendered as
   *  "N+" instead of a falsely-precise "N" (see MailStats capped fields). */
  capped?: boolean
  caption?: string
  captionTone?: "muted" | "attention"
  icon: LucideIcon
  iconTint: string
  wash: string
  onClick?: () => void
}

/** Compact trigger button, styled to match the "Filters" pill used
 *  elsewhere (Resumes list / Scan Mail) — sits in the header next to Sync
 *  Now / Compose. There is always an active range (the Default 15-day
 *  window on load), so the button names it rather than showing a badge. */
function MailFilterButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-filter-trigger
      onClick={onClick}
      className={cn("h-8 gap-1.5 rounded-full text-xs", active && "border-accent-mail text-accent-mail bg-accent-mail/5")}
    >
      <FilterIcon className="size-3.5" />
      {label}
    </Button>
  )
}

/**
 * The Mail page's date filter — the single source of truth for which slice
 * of history is fetched from Zoho. Applying a range re-fetches exactly that
 * range (message list and every count), stores nothing, and never touches
 * ZohoAutoScanJob, which keeps picking up only newly received mail on its
 * own cursor regardless of what is selected here.
 */
function MailFilterPanel({
  preset: initialPreset,
  customFrom: initialCustomFrom,
  customTo: initialCustomTo,
  onApply,
  onClose,
}: {
  preset: MailDateRangePreset
  customFrom: string
  customTo: string
  onApply: (next: { preset: MailDateRangePreset; customFrom: string; customTo: string; range: MailDateRange }) => void
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [preset, setPreset] = useState<MailDateRangePreset>(initialPreset)
  const [customFrom, setCustomFrom] = useState(initialCustomFrom)
  const [customTo, setCustomTo] = useState(initialCustomTo)
  const [resolvedRange, setResolvedRange] = useState<MailDateRange | null>(
    resolveMailDateRange(initialPreset, { from: initialCustomFrom, to: initialCustomTo })
  )

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (panelRef.current?.contains(target)) return
      // The Select's dropdown options render in a portal attached to
      // document.body, outside panelRef's DOM subtree entirely — without
      // this check, picking a preset registers as an "outside" click and
      // closes the whole popover before Apply can ever be pressed.
      if (target instanceof Element && (target.closest('[data-slot="select-content"]') || target.closest('[data-filter-trigger]'))) return
      onClose()
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [onClose])

  function handleApply() {
    if (!resolvedRange) return
    onApply({ preset, customFrom, customTo, range: resolvedRange })
    onClose()
  }

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full z-50 mt-2 flex w-max flex-col gap-2 rounded-lg bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
    >
      <p className="whitespace-nowrap text-xs font-medium text-foreground">Show mail from</p>
      <div className="flex items-start gap-2">
        <MailDateFilter
          preset={preset}
          customFrom={customFrom}
          customTo={customTo}
          onChange={({ preset: p, customFrom: f, customTo: t, resolved }) => {
            setPreset(p)
            setCustomFrom(f)
            setCustomTo(t)
            setResolvedRange(resolved)
          }}
        />
        <Button size="sm" className="h-8 shrink-0 text-xs" disabled={!resolvedRange} onClick={handleApply}>
          Apply
        </Button>
      </div>
    </div>
  )
}

export function MailWorkspace() {
  const { data: connections, isLoading: connectionsLoading } = useMailConnections()
  const connectMailbox = useConnectMailbox()
  const queryClient = useQueryClient()

  const [folder, setFolder] = useState<MailFolder>("inbox")
  const [folderId, setFolderId] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState<string | undefined>(undefined)
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [selectedSummary, setSelectedSummary] = useState<MailMessageSummary | undefined>(undefined)

  const [composeOpen, setComposeOpen] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [rangeFilterOpen, setRangeFilterOpen] = useState(false)

  // The single source of truth for how much mail history is fetched from
  // Zoho — defaults to the last 15 days, drives both the message list and
  // every KPI count, and is stored nowhere. Automatic new-mail scanning
  // runs off its own cursor and is completely unaffected by this.
  const [datePreset, setDatePreset] = useState<MailDateRangePreset>(DEFAULT_MAIL_DATE_RANGE_PRESET)
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [dateFilter, setDateFilter] = useState<MailDateRange | null>(() =>
    resolveMailDateRange(DEFAULT_MAIL_DATE_RANGE_PRESET)
  )

  // What the Filters button names — the preset's own label, or the actual
  // dates once a custom range is in effect.
  const activeRangeLabel =
    datePreset === "custom" && dateFilter
      ? `${dateFilter.from} – ${dateFilter.to}`
      : (MAIL_DATE_RANGE_PRESETS.find((p) => p.value === datePreset)?.label ?? "Date range")

  const connection = connections?.[0]
  const isSearching = searchQuery !== undefined
  const { data: stats, isLoading: statsLoading, isFetching: statsFetching, refetch: refetchStats } = useMailStats(
    connection?.id,
    dateFilter
  )
  const folderQuery = useMailMessages({
    connectionId: connection?.id,
    folder,
    folderId,
    page,
    dateFrom: dateFilter?.from,
    dateTo: dateFilter?.to,
  })
  const searchResults = useMailSearch({ connectionId: connection?.id, q: searchQuery ?? "", page })
  const active = isSearching ? searchResults : folderQuery
  const visibleMessages = active.data?.data ?? []

  const markReadMutation = useMarkMailRead()
  const deleteMutation = useDeleteMailMessage()
  const [bulkPending, setBulkPending] = useState(false)

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
    setCheckedIds(new Set())
  }

  function toggleChecked(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleCheckAll() {
    const ids = visibleMessages.map((m) => m.id)
    const allChecked = ids.length > 0 && ids.every((id) => checkedIds.has(id))
    setCheckedIds(allChecked ? new Set() : new Set(ids))
  }

  async function bulkMarkRead() {
    if (!connection?.id || checkedIds.size === 0) return
    setBulkPending(true)
    try {
      await Promise.all(
        Array.from(checkedIds).map((messageId) =>
          markReadMutation.mutateAsync({ connectionId: connection.id, messageId, read: true })
        )
      )
      setCheckedIds(new Set())
    } finally {
      setBulkPending(false)
    }
  }

  async function bulkDelete() {
    if (!connection?.id || checkedIds.size === 0) return
    if (!confirm(`Delete ${checkedIds.size} selected email${checkedIds.size === 1 ? "" : "s"}?`)) return
    setBulkPending(true)
    try {
      await Promise.all(
        Array.from(checkedIds).map((messageId) => deleteMutation.mutateAsync({ connectionId: connection.id, messageId }))
      )
      setCheckedIds(new Set())
    } finally {
      setBulkPending(false)
    }
  }

  function handleSelectMessage(id: string) {
    setSelectedId(id)
    const clicked = active.data?.data?.find((m) => m.id === id)
    setSelectedSummary(clicked)
    if (clicked && !clicked.isRead && connection?.id) {
      markReadMutation.mutate({ connectionId: connection.id, messageId: id, read: true })
    }
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

  // Real, currently-available stats only — no fabricated trends/percentages.
  const kpis: Kpi[] = [
    {
      key: "total",
      label: "Total Emails",
      value: stats?.totalMessages,
      capped: stats?.totalMessagesCapped,
      icon: MailIcon,
      iconTint: "bg-accent-mail text-accent-mail-foreground",
      wash: "bg-accent-mail/10 border-accent-mail/15",
    },
    {
      key: "unread",
      label: "Unread",
      value: stats?.totalUnread,
      capped: stats?.totalUnreadCapped,
      caption: "Needs attention",
      captionTone: "attention",
      icon: AlertCircleIcon,
      iconTint: "bg-amber-500 text-white",
      wash: "bg-amber-500/10 border-amber-500/15",
      onClick: () => selectFolder("inbox", undefined, "status:unread"),
    },
    {
      key: "inbox",
      label: "Inbox",
      value: stats?.inboxCount,
      capped: stats?.inboxCountCapped,
      caption: stats?.inboxUnread ? `${stats.inboxUnread} unread` : undefined,
      icon: InboxIcon,
      iconTint: "bg-blue-500 text-white",
      wash: "bg-blue-500/10 border-blue-500/15",
      onClick: () => selectFolder("inbox"),
    },
    {
      key: "sent",
      label: "Sent",
      value: stats?.sentCount,
      capped: stats?.sentCountCapped,
      icon: SendIcon,
      iconTint: "bg-emerald-500 text-white",
      wash: "bg-emerald-500/10 border-emerald-500/15",
      onClick: () => selectFolder("sent"),
    },
    {
      key: "drafts",
      label: "Drafts",
      value: stats?.draftsCount,
      capped: stats?.draftsCountCapped,
      icon: LayersIcon,
      iconTint: "bg-purple-500 text-white",
      wash: "bg-purple-500/10 border-purple-500/15",
      onClick: () => selectFolder("drafts"),
    },
  ]

  return (
    <div className="min-w-0 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent-mail/12 text-accent-mail">
            <MailIcon className="size-7" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Mail Dashboard</h2>
              <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                <CheckCircle2Icon className="size-3" /> Connected
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{stats?.emailAddress || connection.emailAddress}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <MailFilterButton
              active={rangeFilterOpen}
              label={activeRangeLabel}
              onClick={() => setRangeFilterOpen((v) => !v)}
            />
            {rangeFilterOpen && (
              <MailFilterPanel
                preset={datePreset}
                customFrom={customFrom}
                customTo={customTo}
                onApply={({ preset, customFrom: f, customTo: t, range }) => {
                  setDatePreset(preset)
                  setCustomFrom(f)
                  setCustomTo(t)
                  setDateFilter(range)
                  setSearchQuery(undefined)
                  setPage(1)
                }}
                onClose={() => setRangeFilterOpen(false)}
              />
            )}
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              await mailApi.stats(connection.id, true)
              await refetchStats()
              queryClient.invalidateQueries({ queryKey: ["mail", "messages"] })
              queryClient.invalidateQueries({ queryKey: ["mail", "folders"] })
            }}
            disabled={statsFetching}
            className="gap-1.5 cursor-pointer"
          >
            <RefreshCwIcon className={`size-4 ${statsFetching ? "animate-spin" : ""}`} />
            Sync Now
          </Button>
          <Button onClick={() => setComposeOpen(true)} className="gap-1.5 shadow-xs cursor-pointer">
            <PenSquareIcon className="size-4" />
            Compose
          </Button>
        </div>
      </div>

      {/* KPI cards — whole-mailbox totals, independent of the range above */}
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">All Time</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((kpi) => (
          <Card
            key={kpi.key}
            role={kpi.onClick ? "button" : undefined}
            tabIndex={kpi.onClick ? 0 : undefined}
            onClick={kpi.onClick}
            onKeyDown={
              kpi.onClick
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      kpi.onClick!()
                    }
                  }
                : undefined
            }
            className={cn(
              "border shadow-2xs transition-all duration-200 select-none",
              kpi.wash,
              kpi.onClick && "cursor-pointer hover:shadow-md hover:-translate-y-0.5"
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", kpi.iconTint)}>
                  <kpi.icon className="size-4.5" />
                </span>
                <div className="text-2xl font-bold text-foreground">
                  {statsLoading ? <Skeleton className="h-7 w-10" /> : `${kpi.value ?? 0}${kpi.capped ? "+" : ""}`}
                </div>
              </div>
              <p className="mt-2 truncate text-xs text-foreground/70">{kpi.label}</p>
              {kpi.caption && (
                <p
                  className={cn(
                    "mt-2 text-[11px] font-medium",
                    kpi.captionTone === "attention" ? "text-amber-800 dark:text-amber-400" : "text-foreground/70"
                  )}
                >
                  {kpi.caption}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Mailbox workspace — folders / messages; clicking a message opens the
          reading pane in a right-side panel instead of a persistent third column */}
      <div className="grid gap-3 lg:grid-cols-5 min-w-0">
        <Card className="p-0 flex flex-col overflow-hidden lg:col-span-1">
          <div className="border-b p-3 shrink-0">
            <h3 className="text-lg font-semibold text-foreground">Mailbox</h3>
          </div>
          <FolderNav
            active={folder}
            onSelect={selectFolder}
            unreadCounts={unreadFolderCounts}
            allFolders={stats?.folders}
            className={`${PANE_HEIGHT} max-h-none flex-1`}
          />
        </Card>

        <Card className={`p-0 flex ${PANE_HEIGHT} min-w-0 flex-col overflow-hidden lg:col-span-4`}>
          <div className="border-b px-6 py-3 shrink-0 flex items-center justify-between gap-2">
            {checkedIds.size > 0 ? (
              <div className="flex w-full items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={visibleMessages.length > 0 && visibleMessages.every((m) => checkedIds.has(m.id))}
                    onChange={toggleCheckAll}
                    className="size-4 shrink-0 cursor-pointer accent-accent-mail"
                    aria-label="Select all"
                  />
                  <span className="text-sm font-medium text-foreground">{checkedIds.size} selected</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" disabled={bulkPending} onClick={bulkMarkRead} className="gap-1.5 text-xs">
                    <MailCheckIcon className="size-3.5" /> Mark read
                  </Button>
                  <Button size="sm" variant="ghost" disabled={bulkPending} onClick={bulkDelete} className="gap-1.5 text-xs text-destructive hover:bg-destructive/10">
                    <Trash2Icon className="size-3.5" /> Delete
                  </Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => setCheckedIds(new Set())}>
                    <XIcon className="size-4" />
                    <span className="sr-only">Clear selection</span>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={visibleMessages.length > 0 && visibleMessages.every((m) => checkedIds.has(m.id))}
                    onChange={toggleCheckAll}
                    disabled={visibleMessages.length === 0}
                    className="size-4 shrink-0 cursor-pointer accent-accent-mail"
                    aria-label="Select all"
                  />
                  <h3 className="text-lg font-semibold text-foreground truncate">
                    {isSearching ? "Search Results" : folder.charAt(0).toUpperCase() + folder.slice(1)}
                  </h3>
                </div>
                {!isSearching && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {active.data?.meta?.totalCount ?? 0}
                    {active.data?.meta?.totalCountCapped ? "+" : ""} total
                  </span>
                )}
              </>
            )}
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
              messages={visibleMessages}
              meta={active.data?.meta}
              selectedId={selectedId}
              onSelect={handleSelectMessage}
              onPageChange={(p) => {
                setPage(p)
                setCheckedIds(new Set())
              }}
              checkedIds={checkedIds}
              onToggleChecked={toggleChecked}
              emptyLabel={isSearching ? "No messages match your search." : "No messages in this folder."}
            />
          )}
        </Card>
      </div>

      {/* Email reading panel — a right-side panel, not a modal, so the
          message list behind it stays visible */}
      <Sheet
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(undefined)
        }}
      >
        <SheetContent side="right" className="w-full sm:w-[45vw] sm:min-w-180 sm:max-w-275 p-0 flex flex-col gap-0 overflow-hidden">
          <MessageReadingPane
            connectionId={connection.id}
            messageId={selectedId}
            listSummary={selectedSummary}
            onBack={() => setSelectedId(undefined)}
          />
        </SheetContent>
      </Sheet>

      {/* Compose & Send Email Dialog */}
      <ComposeMailDialog open={composeOpen} onOpenChange={setComposeOpen} connectionId={connection.id} />
    </div>
  )
}

"use client"

import {
  MailIcon,
  InboxIcon,
  SendIcon,
  HardDriveIcon,
  RefreshCwIcon,
  PenSquareIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  FolderIcon,
  LayersIcon,
  Trash2Icon,
  ArrowUpRightIcon,
  ChevronRightIcon,
} from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useMailStats } from "@/features/mail/hooks/use-mail-messages"
import { mailApi } from "@/features/mail/api"
import type { MailFolder, MailFolderDetail } from "@/types/mail"

function formatStorage(bytes: number) {
  if (!bytes || bytes <= 0) return "0 MB"
  const mb = bytes / (1024 * 1024)
  if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  const gb = mb / 1024
  return `${gb.toFixed(2)} GB`
}

export function MailStatsOverview({
  connectionId,
  emailAddress,
  onCompose,
  onSelectFolder,
}: {
  connectionId: string
  emailAddress?: string
  onCompose: () => void
  onSelectFolder?: (folder: MailFolder, folderId?: string, search?: string) => void
}) {
  const queryClient = useQueryClient()
  const { data: stats, isLoading, isFetching, refetch } = useMailStats(connectionId)

  const usedBytes = stats?.usedStorage || 0
  const totalBytes = stats?.totalStorage || 5 * 1024 * 1024 * 1024
  const storagePercent = totalBytes > 0 ? Math.min(100, Math.max(0.5, (usedBytes / totalBytes) * 100)) : 0

  return (
    <div className="space-y-6">
      {/* Top action / status banner */}
      <div className="flex flex-col gap-4 rounded-2xl border bg-gradient-to-br from-surface to-surface-muted p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MailIcon className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">Zoho Mailbox Dashboard</h2>
                <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                  <CheckCircle2Icon className="size-3" /> Connected
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.emailAddress || emailAddress || "Connected Mailbox"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await mailApi.stats(connectionId, true)
              await refetch()
              queryClient.invalidateQueries({ queryKey: ["mail", "messages"] })
              queryClient.invalidateQueries({ queryKey: ["mail", "folders"] })
            }}
            disabled={isFetching}
            className="gap-1.5 text-xs cursor-pointer"
          >
            <RefreshCwIcon className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Sync Now
          </Button>
          <Button size="sm" onClick={onCompose} className="gap-1.5 text-xs cursor-pointer">
            <PenSquareIcon className="size-3.5" />
            Compose Email
          </Button>
        </div>
      </div>

      {/* Quick Navigation Tabs / Chips */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/20 p-2.5">
        <span className="text-xs font-semibold text-muted-foreground ml-1 mr-1">Quick Folder Tabs:</span>
        <Button
          variant="outline"
          size="xs"
          onClick={() => onSelectFolder?.("inbox")}
          className="gap-1.5 text-xs hover:border-primary/50 hover:bg-background cursor-pointer"
        >
          <InboxIcon className="size-3.5 text-blue-600" />
          <span>Inbox</span>
          {stats?.inboxCount !== undefined && (
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 font-normal">
              {stats.inboxCount}
            </Badge>
          )}
        </Button>
        <Button
          variant="outline"
          size="xs"
          onClick={() => onSelectFolder?.("sent")}
          className="gap-1.5 text-xs hover:border-primary/50 hover:bg-background cursor-pointer"
        >
          <SendIcon className="size-3.5 text-emerald-600" />
          <span>Sent</span>
          {stats?.sentCount !== undefined && (
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 font-normal">
              {stats.sentCount}
            </Badge>
          )}
        </Button>
        <Button
          variant="outline"
          size="xs"
          onClick={() => onSelectFolder?.("drafts")}
          className="gap-1.5 text-xs hover:border-primary/50 hover:bg-background cursor-pointer"
        >
          <LayersIcon className="size-3.5 text-purple-600" />
          <span>Drafts</span>
          {stats?.draftsCount !== undefined && (
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 font-normal">
              {stats.draftsCount}
            </Badge>
          )}
        </Button>
        <Button
          variant="outline"
          size="xs"
          onClick={() => onSelectFolder?.("spam")}
          className="gap-1.5 text-xs hover:border-primary/50 hover:bg-background cursor-pointer"
        >
          <AlertCircleIcon className="size-3.5 text-amber-600" />
          <span>Spam</span>
          {stats?.spamCount !== undefined && (
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 font-normal">
              {stats.spamCount}
            </Badge>
          )}
        </Button>
        <Button
          variant="outline"
          size="xs"
          onClick={() => onSelectFolder?.("trash")}
          className="gap-1.5 text-xs hover:border-primary/50 hover:bg-background cursor-pointer"
        >
          <Trash2Icon className="size-3.5 text-destructive" />
          <span>Trash</span>
          {stats?.trashCount !== undefined && (
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 font-normal">
              {stats.trashCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Clickable Metric Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Unread Emails - Highlighted Card */}
        <Card
          role="button"
          tabIndex={0}
          onClick={() => onSelectFolder?.("inbox", undefined, "status:unread")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onSelectFolder?.("inbox", undefined, "status:unread")
            }
          }}
          className="border-none bg-gradient-to-br from-primary to-primary/85 text-primary-foreground shadow-md shadow-primary/20 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group select-none"
        >
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium text-primary-foreground/80 flex items-center gap-1.5">
                <span>Unread Messages</span>
                <ArrowUpRightIcon className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
              <div className="text-3xl font-semibold mt-1">
                {isLoading ? <Skeleton className="h-8 w-12 bg-primary-foreground/20" /> : (stats?.totalUnread ?? 0)}
              </div>
              <p className="mt-1 text-[11px] text-primary-foreground/70 group-hover:text-primary-foreground transition-colors flex items-center gap-1">
                <span>Click to view unread</span>
                <ChevronRightIcon className="size-3 group-hover:translate-x-0.5 transition-transform" />
              </p>
            </div>
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary-foreground/15 group-hover:bg-primary-foreground/25 transition-colors">
              <AlertCircleIcon className="size-5.5" />
            </span>
          </CardContent>
        </Card>

        {/* Total Inbox */}
        <Card
          role="button"
          tabIndex={0}
          onClick={() => onSelectFolder?.("inbox")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onSelectFolder?.("inbox")
            }
          }}
          className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5 group select-none"
        >
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors flex items-center gap-1.5">
                <span>Inbox Total</span>
                <ArrowUpRightIcon className="size-3 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
              </p>
              <div className="text-3xl font-semibold mt-1">
                {isLoading ? <Skeleton className="h-8 w-12" /> : (stats?.inboxCount ?? 0)}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                <span>{stats?.inboxUnread ?? 0} unread • Open Inbox</span>
                <ChevronRightIcon className="size-3 group-hover:translate-x-0.5 transition-transform" />
              </p>
            </div>
            <span className="flex size-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 group-hover:bg-blue-500/20 transition-colors">
              <InboxIcon className="size-5.5" />
            </span>
          </CardContent>
        </Card>

        {/* Sent Messages */}
        <Card
          role="button"
          tabIndex={0}
          onClick={() => onSelectFolder?.("sent")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onSelectFolder?.("sent")
            }
          }}
          className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5 group select-none"
        >
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors flex items-center gap-1.5">
                <span>Sent Messages</span>
                <ArrowUpRightIcon className="size-3 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
              </p>
              <div className="text-3xl font-semibold mt-1">
                {isLoading ? <Skeleton className="h-8 w-12" /> : (stats?.sentCount ?? 0)}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                <span>Outbound emails • Open Sent</span>
                <ChevronRightIcon className="size-3 group-hover:translate-x-0.5 transition-transform" />
              </p>
            </div>
            <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500/20 transition-colors">
              <SendIcon className="size-5.5" />
            </span>
          </CardContent>
        </Card>

        {/* Drafts */}
        <Card
          role="button"
          tabIndex={0}
          onClick={() => onSelectFolder?.("drafts")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onSelectFolder?.("drafts")
            }
          }}
          className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5 group select-none"
        >
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors flex items-center gap-1.5">
                <span>Drafts & Other</span>
                <ArrowUpRightIcon className="size-3 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
              </p>
              <div className="text-3xl font-semibold mt-1">
                {isLoading ? <Skeleton className="h-8 w-12" /> : (stats?.draftsCount ?? 0)}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                <span>Saved drafts • Open Drafts</span>
                <ChevronRightIcon className="size-3 group-hover:translate-x-0.5 transition-transform" />
              </p>
            </div>
            <span className="flex size-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 group-hover:bg-purple-500/20 transition-colors">
              <LayersIcon className="size-5.5" />
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Storage Quota Card - Wide across window */}
      <Card className="w-full shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <HardDriveIcon className="size-4 text-primary" />
            Mailbox Storage Quota
          </CardTitle>
          <CardDescription className="text-xs">
            Storage allocation on Zoho Mail servers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end justify-between text-xs">
            <div>
              <span className="text-2xl font-bold text-foreground">
                {formatStorage(usedBytes)}
              </span>
              <span className="text-muted-foreground ml-1">
                used of {formatStorage(totalBytes)}
              </span>
            </div>
            <span className="font-semibold text-primary">
              {storagePercent.toFixed(1)}%
            </span>
          </div>

          {/* Storage Progress Bar */}
          <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-primary h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(2, storagePercent)}%` }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1 text-muted-foreground">
            <div className="p-2.5 rounded-lg bg-muted/40 border">
              <p className="text-[11px]">Used Space</p>
              <p className="font-semibold text-foreground text-sm mt-0.5">
                {formatStorage(usedBytes)}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/40 border">
              <p className="text-[11px]">Free Space</p>
              <p className="font-semibold text-foreground text-sm mt-0.5">
                {formatStorage(Math.max(0, totalBytes - usedBytes))}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/40 border">
              <p className="text-[11px]">Total Allocation</p>
              <p className="font-semibold text-foreground text-sm mt-0.5">
                {formatStorage(totalBytes)}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/40 border">
              <p className="text-[11px]">Total Messages</p>
              <p className="font-semibold text-foreground text-sm mt-0.5">
                {stats?.totalMessages ?? 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Folder Activity Breakdown - Full-width below Storage Quota */}
      <Card className="w-full shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FolderIcon className="size-4 text-primary" />
            Folder Activity Breakdown
          </CardTitle>
          <CardDescription className="text-xs">
            Message distribution across mailbox folders
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : !stats?.folders || stats.folders.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">
              No folder details available yet.
            </div>
          ) : (
            <div className="divide-y text-xs">
              {stats.folders.map((folder: MailFolderDetail) => {
                const folderKey = folder.name.toLowerCase()
                return (
                  <div
                    key={folder.id}
                    onClick={() => {
                      onSelectFolder?.(folderKey, folder.id)
                    }}
                    className="flex items-center justify-between py-2.5 hover:bg-muted/40 px-2 rounded-md transition-colors cursor-pointer group"
                    title={`Go to ${folder.name}`}
                  >
                    <div className="flex items-center gap-2">
                      <FolderIcon className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="font-medium capitalize group-hover:text-primary transition-colors">{folder.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      {folder.unreadCount > 0 && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] px-1.5 py-0">
                          {folder.unreadCount} unread
                        </Badge>
                      )}
                      <span className="font-medium text-foreground">
                        {folder.totalCount}
                        {folder.totalCount >= 200 ? "+" : ""} total
                      </span>
                      <ChevronRightIcon className="size-3.5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

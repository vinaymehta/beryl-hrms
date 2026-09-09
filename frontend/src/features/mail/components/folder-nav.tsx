"use client"

import {
  InboxIcon,
  SendIcon,
  FileEditIcon,
  Trash2Icon,
  ShieldAlertIcon,
  FolderIcon,
  LayoutTemplateIcon,
  AlarmClockIcon,
  UploadIcon,
  BellIcon,
  NewspaperIcon,
  ArchiveIcon,
  StarIcon,
  FlagIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "cn"

import type { MailFolder, MailFolderDetail } from "@/types/mail"

const STANDARD_FOLDERS: { key: MailFolder; label: string; icon: typeof InboxIcon }[] = [
  { key: "inbox", label: "Inbox", icon: InboxIcon },
  { key: "sent", label: "Sent", icon: SendIcon },
  { key: "drafts", label: "Drafts", icon: FileEditIcon },
  { key: "spam", label: "Spam", icon: ShieldAlertIcon },
  { key: "trash", label: "Trash", icon: Trash2Icon },
]

// Recognizable icon per well-known custom-folder name, falling back to a
// plain folder icon for anything account-specific we don't recognize.
const CUSTOM_FOLDER_ICONS: [string, LucideIcon][] = [
  ["template", LayoutTemplateIcon],
  ["snooz", AlarmClockIcon],
  ["outbox", UploadIcon],
  ["notification", BellIcon],
  ["newsletter", NewspaperIcon],
  ["archive", ArchiveIcon],
  ["star", StarIcon],
  ["important", FlagIcon],
]

function iconForCustomFolder(name: string): LucideIcon {
  const lower = name.toLowerCase()
  return CUSTOM_FOLDER_ICONS.find(([keyword]) => lower.includes(keyword))?.[1] ?? FolderIcon
}

export function FolderNav({
  active,
  onSelect,
  unreadCounts,
  allFolders,
  className,
}: {
  active: MailFolder
  onSelect: (folder: MailFolder, folderId?: string) => void
  unreadCounts?: Record<string, number>
  allFolders?: MailFolderDetail[]
  className?: string
}) {
  const standardKeys = new Set(STANDARD_FOLDERS.map((f) => f.key))
  const customFolders = (allFolders || []).filter((f) => !standardKeys.has(f.name.toLowerCase() as MailFolder))
  const isCustomActive = !standardKeys.has(active) && !customFolders.some((f) => f.name.toLowerCase() === active.toLowerCase())

  return (
    <nav className={cn("flex flex-col gap-0.5 p-2 overflow-y-auto max-h-[70vh]", className)}>
      {STANDARD_FOLDERS.map(({ key, label, icon: Icon }) => {
        const matchedFolder = allFolders?.find((f) => f.name.toLowerCase() === key)
        const count = matchedFolder?.totalCount ?? unreadCounts?.[key]
        const isCurrent = active.toLowerCase() === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key, matchedFolder?.id)}
            className={cn(
              "flex items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors cursor-pointer",
              isCurrent
                ? "bg-accent-mail/10 text-accent-mail font-semibold"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2.5">
              <Icon className="size-4 shrink-0" />
              <span>{label}</span>
            </div>
            {count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                  "bg-accent-mail/15 text-accent-mail"
                )}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}

      {(customFolders.length > 0 || isCustomActive) && (
        <div className="mt-1">
          
          {customFolders.map((folder) => {
            const folderKey = folder.name.toLowerCase()
            const isCurrent = active.toLowerCase() === folderKey
            const count = folder.totalCount ?? unreadCounts?.[folderKey] ?? folder.unreadCount
            const Icon = iconForCustomFolder(folder.name)
            return (
              <button
                key={folder.id}
                type="button"
                onClick={() => onSelect(folderKey, folder.id)}
                className={cn(
                  "flex items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors cursor-pointer w-full",
                  isCurrent
                    ? "bg-accent-mail/10 text-accent-mail font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className="size-4 shrink-0" />
                  <span className="capitalize truncate">{folder.name}</span>
                </div>
                {count !== undefined && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none shrink-0",
                      "bg-accent-mail/15 text-accent-mail"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}

          {isCustomActive && (() => {
            const Icon = iconForCustomFolder(active)
            return (
              <button
                type="button"
                className="flex items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-semibold bg-accent-mail/10 text-accent-mail cursor-pointer w-full"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className="size-4 shrink-0" />
                  <span className="capitalize truncate">{active}</span>
                </div>
              </button>
            )
          })()}
        </div>
      )}
    </nav>
  )
}

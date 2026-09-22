"use client"

import { BellIcon, CheckCheckIcon } from "lucide-react"
import Link from "next/link"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useNotifications } from "@/features/appraisals/hooks/use-appraisals"
import { useMarkNotificationsRead } from "@/features/appraisals/hooks/use-appraisal-mutations"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@/constants/permissions"

/**
 * The in-app notification feed. Was a UI shell with no producer; the appraisal
 * workflow is the first, and the backend's `notifications` table is generic so
 * the next feature reuses it rather than building a second one.
 */
export function NotificationBell() {
  const canView = usePermission(PERMISSIONS.notificationsView)
  const { data } = useNotifications(canView)
  const markAllRead = useMarkNotificationsRead()

  const notifications = data?.data ?? []
  const unreadCount = data?.meta.unreadCount ?? 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="relative" aria-label="Notifications" />}
      >
        <BellIcon className="size-4.5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup>
          <div className="flex items-center justify-between gap-2 pr-1">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => markAllRead.mutate()}
              >
                <CheckCheckIcon className="size-3.5" /> Mark all read
              </Button>
            )}
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        {notifications.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            You&apos;re all caught up — no notifications yet.
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {notifications.map((notification) => {
              const content = (
                <div
                  className={cn(
                    "grid gap-0.5 px-2 py-2 transition-colors hover:bg-accent",
                    !notification.readAt && "bg-role-hr/5"
                  )}
                >
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    {!notification.readAt && (
                      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-role-hr" />
                    )}
                    {notification.title}
                  </p>
                  {notification.body && (
                    <p className="text-xs text-muted-foreground">{notification.body}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(notification.createdAt).toLocaleDateString()}
                  </p>
                </div>
              )

              return (
                <li key={notification.id} className="rounded-md">
                  {notification.actionUrl ? (
                    <Link href={notification.actionUrl}>{content}</Link>
                  ) : (
                    content
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

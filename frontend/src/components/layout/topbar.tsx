"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { SettingsIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "cn"
import { MobileNav } from "@/components/layout/mobile-nav"
import { NotificationBell } from "@/components/layout/notification-bell"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { UserMenu } from "@/components/layout/user-menu"

export function Topbar() {
  const pathname = usePathname()
  const onSettings = pathname.startsWith("/all-settings")

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-surface/80 px-4 backdrop-blur-sm supports-backdrop-filter:bg-surface/60">
      {/* MobileNav on every route. Settings used to swap this for a panel
          open/close button, which was the only place in the app where the
          sidebar could be dismissed — and on a phone it replaced the only way
          to reach the nav at all. */}
      <div className="flex items-center gap-2">
        <MobileNav />
      </div>
      <div className="flex items-center gap-1">
        {/* Opens the full-screen All Settings window — workspace
            administration, which is a different mode from using the product.
            The sidebar's own Settings entry is a different thing: your own
            account, nothing else. */}
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="All settings"
          aria-current={onSettings ? "page" : undefined}
          nativeButton={false}
          render={<Link href="/all-settings" />}
          className={cn(
            "size-8",
            onSettings ? "text-role-admin" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <SettingsIcon className="size-4" />
        </Button>
        <NotificationBell />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}

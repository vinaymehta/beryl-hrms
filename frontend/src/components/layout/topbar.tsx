"use client"

import { MobileNav } from "@/components/layout/mobile-nav"
import { NotificationBell } from "@/components/layout/notification-bell"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { UserMenu } from "@/components/layout/user-menu"

export function Topbar() {
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
        <NotificationBell />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}

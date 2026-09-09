import { MobileNav } from "@/components/layout/mobile-nav"
import { NotificationBell } from "@/components/layout/notification-bell"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { UserMenu } from "@/components/layout/user-menu"

export function Topbar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-surface/80 px-4 backdrop-blur-sm supports-backdrop-filter:bg-surface/60">
      {/* MobileNav's trigger is display:none above the md breakpoint — without
          this wrapper div, the header is left with a single flex child on
          desktop, and justify-between collapses a lone item to flex-start
          instead of pushing it to the right edge. */}
      <div>
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

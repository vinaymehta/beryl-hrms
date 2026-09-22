"use client"

import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { MobileNav } from "@/components/layout/mobile-nav"
import { NotificationBell } from "@/components/layout/notification-bell"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { UserMenu } from "@/components/layout/user-menu"
import { useSidebar } from "@/components/layout/sidebar-context"

export function Topbar() {
  const { isSettings, isOpen, toggle } = useSidebar()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-surface/80 px-4 backdrop-blur-sm supports-backdrop-filter:bg-surface/60">
      {/* On settings routes, render the dedicated button that opens and closes
          the side panel. On all other routes, keep the standard layout ("only in setting"). */}
      <div className="flex items-center gap-2">
        {isSettings ? (
          <Button
            variant="outline"
            size="icon"
            onClick={toggle}
            aria-label={isOpen ? "Close side panel" : "Open side panel"}
            title={isOpen ? "Close side panel" : "Open side panel"}
            className="size-8.5 shadow-2xs"
          >
            {isOpen ? (
              <PanelLeftCloseIcon className="size-4.5" />
            ) : (
              <PanelLeftOpenIcon className="size-4.5" />
            )}
          </Button>
        ) : (
          <MobileNav />
        )}
      </div>
      <div className="flex items-center gap-1">
        <NotificationBell />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}

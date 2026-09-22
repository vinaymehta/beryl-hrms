"use client"

import Link from "next/link"
import { PanelLeftCloseIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SidebarNav } from "@/components/layout/sidebar-nav"
import { useSidebar } from "@/components/layout/sidebar-context"

export function Sidebar() {
  const { isOpen, isSettings, close } = useSidebar()

  if (isSettings) {
    if (!isOpen) return null

    return (
      <>
        {/* Mobile backdrop when opened in settings */}
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden"
          onClick={close}
          aria-hidden="true"
        />
        <aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-sidebar-border bg-sidebar shadow-2xl md:static md:w-64 md:shrink-0 md:shadow-none">
          <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
            <Link
              href="/"
              onClick={close}
              className="flex items-center gap-2.5 font-semibold tracking-tight text-sidebar-foreground"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent-foreground text-sm text-primary-foreground shadow-sm shadow-primary/30">
                H
              </span>
              HR Platform
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={close}
              className="size-8 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              aria-label="Collapse sidebar"
              title="Close side panel"
            >
              <PanelLeftCloseIcon className="size-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto py-3">
            <SidebarNav onNavigate={close} />
          </div>
        </aside>
      </>
    )
  }

  return (
    <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
      <Link
        href="/"
        className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4 font-semibold tracking-tight text-sidebar-foreground"
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent-foreground text-sm text-primary-foreground shadow-sm shadow-primary/30">
          H
        </span>
        HR Platform
      </Link>
      <div className="flex-1 overflow-y-auto py-3">
        <SidebarNav />
      </div>
    </aside>
  )
}

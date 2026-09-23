"use client"

import Link from "next/link"

import { SidebarNav } from "@/components/layout/sidebar-nav"

/**
 * The desktop sidebar. Always on, on every route — Settings used to collapse
 * it and hand you a button to get it back, which made the nav come and go
 * depending on where you were standing. Narrow screens reach the same nav
 * through MobileNav in the topbar.
 */
export function Sidebar() {
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

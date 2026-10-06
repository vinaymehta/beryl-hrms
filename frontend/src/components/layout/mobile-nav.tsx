"use client"

import { useState } from "react"
import { MenuIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { SidebarNav } from "@/components/layout/sidebar-nav"
import { BrandMark } from "@/components/brand/brand-mark"

export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground md:hidden" aria-label="Open navigation" />}
      >
        <MenuIcon className="size-4.5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
        <SheetHeader className="border-b border-sidebar-border px-4 py-3">
          <SheetTitle className="text-sidebar-foreground">
            <BrandMark />
          </SheetTitle>
        </SheetHeader>
        <div className="py-3">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

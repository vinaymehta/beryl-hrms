"use client"

import { useEffect, useRef, useState } from "react"
import { FilterIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "cn"

interface FilterPopoverProps {
  /** Drives the badge on the trigger and whether Clear is offered. */
  activeCount?: number
  /** Accent applied while open or while any filter is set — the module's role color. */
  accentClassName?: string
  /** Matching accent for the count badge. */
  badgeClassName?: string
  onReset?: () => void
  /** Labels the trigger for assistive tech; the visible text is always "Filter". */
  ariaLabel?: string
  className?: string
  children: React.ReactNode
}

/**
 * The one filter control in the app: a compact trigger that opens a small
 * popover anchored under it, holding whatever selects the calling view wants
 * to offer.
 *
 * Extracted from the Resumes list so Employees stops being a second,
 * differently sized implementation of the same idea (it expanded a full-width
 * bordered strip below the search row). Callers supply only the controls and
 * their accent color — the geometry is fixed here so every module's filter is
 * literally the same size and shape.
 */
export function FilterPopover({
  activeCount = 0,
  accentClassName,
  badgeClassName,
  onReset,
  ariaLabel = "Filter",
  className,
  children,
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (panelRef.current?.contains(target)) return
      // Select renders its options in a portal outside this panel's DOM
      // subtree, and the trigger already handles its own toggle — excluding
      // both stops a click meant for either from closing the panel.
      if (target instanceof Element && (target.closest('[data-slot="select-content"]') || target.closest("[data-filter-trigger]"))) {
        return
      }
      setOpen(false)
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [open])

  const isAccented = open || activeCount > 0

  return (
    <div className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-filter-trigger
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn("relative h-9 shrink-0 gap-1.5 rounded-full text-xs", isAccented && accentClassName)}
      >
        <FilterIcon className="size-3.5" />
        Filter
        {activeCount > 0 && (
          <span
            className={cn(
              "absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full text-[10px] font-bold",
              badgeClassName
            )}
          >
            {activeCount}
          </span>
        )}
      </Button>

      {/* Always mounted, only visually hidden — unmounting and remounting the
          Select components on every toggle made them briefly show their raw
          value instead of the matching option's label the first time they
          re-registered. */}
      <div
        ref={panelRef}
        hidden={!open}
        className="absolute right-0 top-full z-50 mt-2 flex w-max flex-col items-start gap-2 rounded-lg bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
      >
        {children}

        {onReset && activeCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-7 w-full justify-center text-xs text-muted-foreground hover:text-foreground"
          >
            Clear filters
          </Button>
        )}
      </div>
    </div>
  )
}

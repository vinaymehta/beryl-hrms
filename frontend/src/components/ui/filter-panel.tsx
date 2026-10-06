"use client"

import { useState } from "react"
import { FilterIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PanelBody, PanelFooter, PanelHeader } from "@/components/ui/panel"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { cn } from "cn"

interface FilterPanelProps {
  /** Drives the badge on the trigger and whether Clear is offered. */
  activeCount?: number
  /** Accent applied while open or while any filter is set — the module's role color. */
  accentClassName?: string
  /** Matching accent for the count badge. */
  badgeClassName?: string
  onReset?: () => void
  /** Labels the trigger for assistive tech. */
  ariaLabel?: string
  /** Visible trigger text. "Filter" unless the view names its current filter (Mail's date range). */
  label?: React.ReactNode
  /** Heading inside the panel. Defaults to a generic one. */
  title?: string
  description?: string
  className?: string
  children: React.ReactNode
}

/**
 * The one filter control in the app: a trigger beside the search box that
 * opens a panel from the right, holding whatever controls the calling view
 * wants to offer.
 *
 * It used to be a popover anchored under the trigger, and it outgrew that. A
 * popover is sized by its contents, so each module's filter ended up a
 * different shape; it covers the very list you are filtering; it has nowhere
 * to put a label, so controls were identified only by their placeholder text;
 * and it needed hand-rolled click-outside and Escape handling that had to
 * special-case Select's portal to avoid closing on its own options. A panel
 * has room to label things, sits beside the list rather than over it, and
 * gets focus trapping and dismissal from Sheet.
 *
 * Callers supply only the controls — one PanelSection per filter, usually a
 * PanelOptionList — and their accent color. The geometry, the header and the
 * Clear all/Done footer are fixed here, so every module's filter is literally
 * the same size and shape.
 */
export function FilterPanel({
  activeCount = 0,
  accentClassName,
  badgeClassName,
  onReset,
  ariaLabel = "Filter",
  label = "Filter",
  title = "Filters",
  description,
  className,
  children,
}: FilterPanelProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn(
          "relative h-9 shrink-0 gap-1.5 rounded-full text-xs",
          activeCount > 0 && accentClassName,
          className
        )}
      >
        <FilterIcon className="size-3.5" />
        {label}
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

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          {/* Every control applies the moment it changes — the list behind the
              panel is already filtered, so the footer only closes it. */}
          <PanelHeader icon={FilterIcon} title={title} description={description ?? "Changes apply immediately."} />
          <PanelBody>{children}</PanelBody>
          {/* Clear all at the left edge, Done at the right — as it has always been. */}
          <PanelFooter className="justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={onReset}
              disabled={!onReset || activeCount === 0}
              className="text-muted-foreground"
            >
              Clear all
            </Button>
            <Button type="button" onClick={() => setOpen(false)} className="min-w-20">
              Done
            </Button>
          </PanelFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}

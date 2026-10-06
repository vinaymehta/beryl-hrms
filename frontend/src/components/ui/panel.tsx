"use client"

import type { ReactNode } from "react"
import { CheckIcon, type LucideIcon } from "lucide-react"
import { cn } from "cn"

import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

/**
 * The parts every side panel is built from — filters and forms alike — so
 * they all share one shape:
 *
 *   PanelHeader   icon tile, title, one line of description (close X is SheetContent's)
 *   PanelBody     the scrolling, lightly tinted area that holds the sections
 *   PanelSection  a white card with an UPPERCASE label strip
 *   PanelFooter   pinned to the bottom: secondary action left, primary right
 *
 * Use inside <SheetContent className="flex flex-col gap-0 p-0 …">.
 */
export function PanelHeader({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: LucideIcon
  title: ReactNode
  description?: ReactNode
  className?: string
}) {
  return (
    <SheetHeader className={cn("shrink-0 flex-row items-center gap-3 border-b bg-background px-5 py-4 pr-14", className)}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <SheetTitle className="text-base leading-tight font-semibold">{title}</SheetTitle>
        {description && <SheetDescription className="mt-0.5 text-sm">{description}</SheetDescription>}
      </div>
    </SheetHeader>
  )
}

export function PanelBody({ className, children }: { className?: string; children: ReactNode }) {
  // Block layout with space-y, NOT a grid. As a grid that is also the flex-1
  // scroll container it has a definite height, so once the content overflows
  // the auto rows shrink to their minimum — which for an overflow-hidden card
  // is 0 — and every section collapses to a sliver. Block children keep their
  // content height and the container simply scrolls.
  return (
    <div className={cn("min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/40 p-4 sm:p-5", className)}>
      {children}
    </div>
  )
}

export function PanelSection({
  title,
  description,
  action,
  flush = false,
  className,
  children,
}: {
  title: ReactNode
  /** Optional normal-case line under the label, for sections that need explaining. */
  description?: ReactNode
  /** Right-aligned in the label strip — a small button or badge. */
  action?: ReactNode
  /** No inner padding — for edge-to-edge row lists like PanelOptionList. */
  flush?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn("overflow-hidden rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className={cn(!flush && "grid gap-3.5 p-4")}>{children}</div>
    </section>
  )
}

export function PanelFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex shrink-0 items-center justify-end gap-2 border-t bg-background px-5 py-3", className)}>
      {children}
    </div>
  )
}

/**
 * A one-of-many choice as a list of rows — an "All" row first, then each
 * option — with the chosen row in bold and ticked on the right. Single choice
 * (a radio group), because every filter it serves takes one value.
 */
export function PanelOptionList<T extends string>({
  label,
  options,
  value,
  onChange,
  allLabel = "All",
}: {
  /** Accessible name for the group — usually the section title. */
  label: string
  options: { value: T; label: ReactNode }[]
  /** undefined means "All". */
  value: T | undefined
  onChange: (next: T | undefined) => void
  /** Pass null for a list where one option must always be chosen (no "All" row). */
  allLabel?: ReactNode | null
}) {
  const rows: { value: T | undefined; label: ReactNode }[] =
    allLabel === null ? options : [{ value: undefined, label: allLabel }, ...options]

  return (
    <div role="radiogroup" aria-label={label} className="divide-y">
      {rows.map((row) => {
        const checked = row.value === value
        return (
          <button
            key={row.value ?? "__all"}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(row.value)}
            className={cn(
              "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted/60",
              checked ? "font-semibold text-foreground" : "text-foreground/80"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                checked ? "border-primary" : "border-input"
              )}
            >
              {checked && <span className="size-2 rounded-full bg-primary" />}
            </span>
            <span className="min-w-0 flex-1 truncate">{row.label}</span>
            {checked && <CheckIcon aria-hidden className="size-4 shrink-0 text-primary" />}
          </button>
        )
      })}
    </div>
  )
}

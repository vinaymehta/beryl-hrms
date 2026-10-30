"use client"

import { cn } from "cn"

/**
 * Active/Paused as a switch with its word beside it — the state is never
 * carried by colour alone: the knob's side and the label say it too.
 */
export function StatusSwitch({
  checked,
  onChange,
  label,
  disabled = false,
  id,
}: {
  checked: boolean
  onChange: () => void
  /** Accessible name — what switching it on does. */
  label: string
  disabled?: boolean
  id?: string
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={onChange}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
          checked ? "bg-success" : "bg-muted-foreground/30"
        )}
      >
        <span
          className={cn(
            "inline-block size-4 rounded-full bg-background shadow transition-transform dark:bg-foreground",
            checked ? "translate-x-4.5" : "translate-x-0.5"
          )}
        />
      </button>
      <span className={cn("text-xs font-medium", checked ? "text-success" : "text-muted-foreground")}>
        {checked ? "Active" : "Paused"}
      </span>
    </span>
  )
}

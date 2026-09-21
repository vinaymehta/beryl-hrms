"use client"

import { useMemo, useState } from "react"
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from "lucide-react"
import { cn } from "cn"

import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import type { MultiSelectOption } from "@/components/ui/multi-select"

/** Same option shape as MultiSelect, so a caller can feed both from one list. */
export type SearchSelectOption = Omit<MultiSelectOption, "locked" | "lockedHint">

interface SearchSelectProps {
  options: SearchSelectOption[]
  value: string | null
  onChange: (next: string | null) => void
  placeholder?: string
  searchPlaceholder?: string
  /** Hand search to the server instead of filtering `options` locally. */
  onSearchChange?: (query: string) => void
  isLoading?: boolean
  emptyMessage?: string
  /** Offers an X on the trigger to return to "nothing selected". */
  clearable?: boolean
  disabled?: boolean
  invalid?: boolean
  id?: string
  className?: string
  "aria-label"?: string
}

/**
 * Searchable single-value select: one choice, closes on pick, optionally
 * clearable.
 *
 * Deliberately NOT MultiSelect with a cap of one — the interactions differ in
 * every detail that matters (chips vs. a single value, stays open vs. closes,
 * "remove" vs. "clear"), and a `max={1}` flag on the multi control would make
 * both harder to read. It is also not Base UI's Select, which has no search
 * and so stops being usable past a couple of dozen options.
 */
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  onSearchChange,
  isLoading = false,
  emptyMessage = "No matches.",
  clearable = false,
  disabled = false,
  invalid = false,
  id,
  className,
  "aria-label": ariaLabel,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  // Server-side search (onSearchChange given) means `options` already IS the
  // result set — filtering it again locally would hide rows the server
  // deliberately matched on a field we don't render.
  const visible = useMemo(() => {
    if (onSearchChange || !query.trim()) return options
    const needle = query.trim().toLowerCase()
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        option.description?.toLowerCase().includes(needle)
    )
  }, [options, query, onSearchChange])

  const selected = options.find((option) => option.value === value) ?? null

  function handleSearch(next: string) {
    setQuery(next)
    onSearchChange?.(next)
  }

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30",
          className
        )}
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-2">
            {selected.adornment}
            <span className="min-w-0">
              <span className="block truncate leading-tight">{selected.label}</span>
              {selected.description && (
                <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                  {selected.description}
                </span>
              )}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}

        <span className="flex shrink-0 items-center gap-0.5">
          {clearable && selected && !disabled && (
            // A span, not a nested <button>: this trigger is itself a button,
            // and a button inside a button is invalid HTML.
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear selection"
              className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation()
                onChange(null)
              }}
            >
              <XIcon className="size-3.5" />
            </span>
          )}
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        </span>
      </PopoverTrigger>

      <PopoverContent className="w-(--anchor-width) min-w-64 p-0">
        <div className="relative border-b p-2">
          <SearchIcon className="absolute top-1/2 left-4 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => handleSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 border-0 pl-7 text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>

        <div className="max-h-64 overflow-y-auto p-1">
          {isLoading ? (
            <div className="space-y-1 p-1">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">{emptyMessage}</p>
          ) : (
            visible.map((option) => {
              const isSelected = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(isSelected && clearable ? null : option.value)
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {option.adornment}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{option.label}</span>
                    {option.description && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {isSelected && <CheckIcon className="size-4 shrink-0 text-primary" />}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

"use client"

import { useMemo, useState } from "react"
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon, LockIcon } from "lucide-react"
import { cn } from "cn"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"

export interface MultiSelectOption {
  value: string
  label: string
  /** Second line in the list — e.g. an employee's code and designation. */
  description?: string
  /** Rendered left of the label: an avatar, a coloured dot, an icon. */
  adornment?: React.ReactNode
  /** Shown as selected and permanently checked — can't be toggled off. */
  locked?: boolean
  lockedHint?: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  /** Prompt inside the search box; omit the box entirely with `searchable={false}`. */
  searchPlaceholder?: string
  searchable?: boolean
  /** Hand search to the server instead of filtering `options` locally. */
  onSearchChange?: (query: string) => void
  isLoading?: boolean
  emptyMessage?: string
  disabled?: boolean
  id?: string
  className?: string
  "aria-label"?: string
}

/**
 * The app's one many-of-N control: a field-shaped trigger showing the current
 * selection as removable chips, opening a searchable checkbox list.
 *
 * Built here rather than per-feature because two separate pickers on the
 * Employee form (reporting managers, roles) want exactly this, and a third
 * (skills, locations…) is the obvious next one. Base UI's Select is
 * deliberately not reused: it is single-value and closes on pick, which is
 * the wrong interaction for choosing several managers in a row.
 */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  searchable = true,
  onSearchChange,
  isLoading = false,
  emptyMessage = "No matches.",
  disabled = false,
  id,
  className,
  "aria-label": ariaLabel,
}: MultiSelectProps) {
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

  const selected = useMemo(
    () => options.filter((option) => value.includes(option.value) || option.locked),
    [options, value]
  )

  function toggle(option: MultiSelectOption) {
    if (option.locked) return
    onChange(
      value.includes(option.value)
        ? value.filter((v) => v !== option.value)
        : [...value, option.value]
    )
  }

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
        className={cn(
          "flex min-h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-left text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
          className
        )}
      >
        {selected.length === 0 ? (
          <span className="text-muted-foreground">{placeholder}</span>
        ) : (
          <span className="flex flex-wrap items-center gap-1">
            {selected.map((option) => (
              <Badge
                key={option.value}
                variant="secondary"
                className="h-6 max-w-52 gap-1 pr-1 pl-2 font-normal"
              >
                <span className="truncate">{option.label}</span>
                {option.locked ? (
                  <LockIcon className="size-3 shrink-0 text-muted-foreground" />
                ) : (
                  // A span, not a nested <button>: this trigger is itself a
                  // button, and a button inside a button is invalid HTML that
                  // React will warn about and browsers render unpredictably.
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Remove ${option.label}`}
                    className="flex size-4 shrink-0 items-center justify-center rounded-full hover:bg-foreground/10"
                    onClick={(event) => {
                      event.stopPropagation()
                      onChange(value.filter((v) => v !== option.value))
                    }}
                  >
                    <XIcon className="size-3" />
                  </span>
                )}
              </Badge>
            ))}
          </span>
        )}
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>

      <PopoverContent className="w-(--anchor-width) min-w-64 p-0">
        {searchable && (
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
        )}

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
              const isSelected = option.locked || value.includes(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.locked}
                  onClick={() => toggle(option)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                    option.locked && "cursor-default opacity-80 hover:bg-transparent"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input",
                      isSelected && "border-primary bg-primary text-primary-foreground"
                    )}
                  >
                    {isSelected && <CheckIcon className="size-3" />}
                  </span>
                  {option.adornment}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{option.label}</span>
                    {option.description && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {option.locked && option.lockedHint && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">{option.lockedHint}</span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

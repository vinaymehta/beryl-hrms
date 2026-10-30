"use client"

import { Autocomplete } from "@base-ui/react/autocomplete"
import { ChevronsUpDownIcon } from "lucide-react"
import { cn } from "cn"

/**
 * Free text with suggestions: pick a value already in use, or type a new one.
 * What a creatable select would be — the app has none, and Base UI's
 * Autocomplete is exactly "free-form input, optional suggestions".
 */
export function SuggestInput({
  id,
  value,
  onChange,
  options,
  placeholder,
  invalid = false,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  invalid?: boolean
}) {
  return (
    <Autocomplete.Root
      items={options}
      value={value}
      onValueChange={(next) => onChange(next)}
      // A value that is already one of the options shows them all — opening
      // a filled field is choosing again, not searching.
      filter={(option: string, query) => {
        const typed = query.trim().toLowerCase()
        return !typed || options.some((o) => o.toLowerCase() === typed) || option.toLowerCase().includes(typed)
      }}
      openOnInputClick
    >
      <Autocomplete.InputGroup
        className={cn(
          "flex h-9 w-full min-w-0 items-center rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
          invalid && "border-destructive ring-3 ring-destructive/20 dark:border-destructive/50"
        )}
      >
        <Autocomplete.Input
          id={id}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-base outline-none placeholder:text-muted-foreground md:text-sm"
        />
        <Autocomplete.Trigger
          aria-label="Show suggestions"
          className="flex h-full w-8 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <ChevronsUpDownIcon className="size-3.5" />
        </Autocomplete.Trigger>
      </Autocomplete.InputGroup>

      <Autocomplete.Portal>
        <Autocomplete.Positioner className="z-50 outline-none" sideOffset={4}>
          <Autocomplete.Popup className="w-(--anchor-width) max-w-(--available-width) overflow-hidden rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 data-empty:hidden">
            <Autocomplete.List className="max-h-[min(16rem,var(--available-height))] overflow-y-auto overscroll-contain">
              {(option: string) => (
                <Autocomplete.Item
                  key={option}
                  value={option}
                  className="flex cursor-default items-center rounded-md px-2 py-1.5 outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  {option}
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  )
}

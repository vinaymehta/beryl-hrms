"use client"

import { useEffect, useRef, useState, type KeyboardEvent, type Ref } from "react"
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"

/**
 * A calendar dropdown for an ISO date ("YYYY-MM-DD", or "" for none) — the
 * same value an <input type="date"> holds, so it drops into a react-hook-form
 * field with `{...field}` unchanged.
 *
 * Exists because the native picker is a browser popup the page can't
 * position: inside the scrolling Add-employee sheet it did not move with the
 * form, opened upward over the field near the bottom of the screen, and looks
 * different in every browser. This one is anchored to the field, opens below
 * it, and greys out every day outside `min`/`max` instead of letting one be
 * picked and rejected afterwards.
 */
interface DatePickerProps {
  value?: string
  onChange: (next: string) => void
  /** Called when the calendar closes — marks the field touched for validation. */
  onBlur?: () => void
  min?: string
  max?: string
  placeholder?: string
  /** Offers a Clear button. Off for fields that always carry a date. */
  clearable?: boolean
  disabled?: boolean
  id?: string
  name?: string
  ref?: Ref<HTMLButtonElement>
  className?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
const MONTHS = Array.from({ length: 12 }, (_, m) =>
  new Date(2000, m, 1).toLocaleDateString("en-GB", { month: "long" })
)

// Local-time parsing on purpose: `new Date("2026-10-06")` is UTC midnight,
// which is the previous day anywhere west of Greenwich.
function parseIso(iso: string | undefined): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function toIso(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function addDays(iso: string, days: number) {
  const d = parseIso(iso) as Date
  d.setDate(d.getDate() + days)
  return toIso(d)
}

/** Monday-first weeks covering the whole month, padded with neighbouring days. */
function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

/** Roughly the open calendar's height plus its offset from the field. */
const CALENDAR_HEIGHT = 360

function makeRoomBelow(trigger: HTMLElement | null) {
  if (!trigger) return
  const shortfall = trigger.getBoundingClientRect().bottom + CALENDAR_HEIGHT - window.innerHeight
  if (shortfall <= 0) return
  // The nearest ancestor that actually scrolls — the sheet body, on the form.
  for (let el = trigger.parentElement; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el)
    if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) {
      el.scrollBy({ top: shortfall })
      return
    }
  }
}

export function DatePicker({
  value,
  onChange,
  onBlur,
  min,
  max,
  placeholder = "Pick a date",
  clearable = false,
  disabled = false,
  id,
  name,
  ref,
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = parseIso(value)
  const todayIso = toIso(new Date())
  const inRange = (iso: string) => (!min || iso >= min) && (!max || iso <= max)
  const clamp = (iso: string) => (min && iso < min ? min : max && iso > max ? max : iso)

  // The month on screen and the day keyboard focus sits on, both reset to the
  // current value (or today, kept inside the range) each time it opens.
  const [focusedIso, setFocusedIso] = useState(() => clamp(value || todayIso))
  const [view, setView] = useState(() => {
    const d = parseIso(focusedIso) as Date
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  // Set by arrow keys: focus follows the focused day after the re-render.
  const moveFocus = useRef(false)

  function setRefs(node: HTMLButtonElement | null) {
    triggerRef.current = node
    if (typeof ref === "function") ref(node)
    else if (ref) ref.current = node
  }

  function show(iso: string) {
    const d = parseIso(iso) as Date
    setFocusedIso(iso)
    setView({ year: d.getFullYear(), month: d.getMonth() })
  }

  function handleOpenChange(next: boolean) {
    if (disabled) return
    if (next) {
      show(clamp(value || todayIso))
      // Scroll the surrounding form just enough for the calendar to fit BELOW
      // the field, rather than letting it flip up over it. Instant, not
      // smooth: the popup is positioned from where the field is the moment it
      // opens.
      makeRoomBelow(triggerRef.current)
    } else {
      onBlur?.()
    }
    setOpen(next)
  }

  function pick(iso: string) {
    if (!inRange(iso)) return
    onChange(iso)
    handleOpenChange(false)
  }

  // Keyboard focus follows the focused day — only after an arrow key asked it
  // to move, never on an ordinary re-render. Opening is handled by the popup's
  // initialFocus below, which runs after Base UI's own focus management.
  useEffect(() => {
    if (!open || !moveFocus.current) return
    moveFocus.current = false
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${focusedIso}"]`)?.focus()
  })

  function handleGridKey(event: KeyboardEvent) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key]
    if (step === undefined) return
    event.preventDefault()
    const next = addDays(focusedIso, step)
    if (!inRange(next)) return
    moveFocus.current = true
    show(next)
  }

  function shiftMonth(delta: number) {
    const d = new Date(view.year, view.month + delta, 1)
    setView({ year: d.getFullYear(), month: d.getMonth() })
  }

  const minDate = parseIso(min)
  const maxDate = parseIso(max)
  const thisYear = new Date().getFullYear()
  const firstYear = minDate?.getFullYear() ?? thisYear - 100
  const lastYear = maxDate?.getFullYear() ?? thisYear + 10
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i)
  // Month-level bounds, compared as yyyy-mm so a partly-allowed month stays reachable.
  const monthKey = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, "0")}`
  const monthAllowed = (year: number, month: number) =>
    (!min || monthKey(year, month) >= min.slice(0, 7)) && (!max || monthKey(year, month) <= max.slice(0, 7))

  const days = monthGrid(view.year, view.month)
  const selectClass =
    "h-7 rounded-md border border-input bg-transparent px-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        ref={setRefs}
        id={id}
        name={name}
        disabled={disabled}
        aria-invalid={ariaInvalid || undefined}
        aria-describedby={ariaDescribedBy}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30",
          className
        )}
      >
        {selected ? (
          <span className="truncate">
            {selected.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        // Above or below the field only — never beside it, where it covers
        // the neighbouring column of the form.
        collisionAvoidance={{ fallbackAxisSide: "none" }}
        initialFocus={() => gridRef.current?.querySelector<HTMLElement>(`[data-iso="${focusedIso}"]`) ?? true}
        className="w-auto p-3"
      >
        <div className="mb-2 flex items-center justify-between gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Previous month"
            disabled={!monthAllowed(new Date(view.year, view.month - 1).getFullYear(), new Date(view.year, view.month - 1).getMonth())}
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeftIcon />
          </Button>
          <div className="flex items-center gap-1">
            <select
              aria-label="Month"
              className={selectClass}
              value={view.month}
              onChange={(event) => setView({ ...view, month: Number(event.target.value) })}
            >
              {MONTHS.map((label, month) => (
                <option key={label} value={month} disabled={!monthAllowed(view.year, month)}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label="Year"
              className={selectClass}
              value={view.year}
              onChange={(event) => {
                const year = Number(event.target.value)
                // Keep the month if it exists in the new year's range, otherwise
                // land on the nearest month that does.
                const month = monthAllowed(year, view.month)
                  ? view.month
                  : (parseIso(clamp(toIso(new Date(year, view.month, 1)))) as Date).getMonth()
                setView({ year, month })
              }}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            disabled={!monthAllowed(new Date(view.year, view.month + 1).getFullYear(), new Date(view.year, view.month + 1).getMonth())}
            onClick={() => shiftMonth(1)}
          >
            <ChevronRightIcon />
          </Button>
        </div>

        <div role="grid" ref={gridRef} onKeyDown={handleGridKey} className="grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map((day) => (
            <div key={day} role="columnheader" className="flex h-7 items-center justify-center text-xs text-muted-foreground">
              {day}
            </div>
          ))}
          {days.map((day) => {
            const iso = toIso(day)
            const outside = day.getMonth() !== view.month
            const allowed = inRange(iso)
            const isSelected = iso === value
            return (
              <button
                key={iso}
                type="button"
                role="gridcell"
                data-iso={iso}
                tabIndex={iso === focusedIso ? 0 : -1}
                disabled={!allowed}
                aria-selected={isSelected}
                aria-label={day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                onClick={() => pick(iso)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                  outside && "text-muted-foreground/60",
                  allowed && !isSelected && "hover:bg-muted",
                  iso === todayIso && !isSelected && "font-semibold text-primary",
                  isSelected && "bg-primary text-primary-foreground",
                  !allowed && "cursor-not-allowed text-muted-foreground/30 line-through decoration-muted-foreground/30"
                )}
              >
                {day.getDate()}
              </button>
            )
          })}
        </div>

        <div className="mt-2 flex items-center justify-between border-t pt-2">
          <Button type="button" variant="ghost" size="sm" disabled={!inRange(todayIso)} onClick={() => pick(todayIso)}>
            Today
          </Button>
          {clearable && value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange("")
                handleOpenChange(false)
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

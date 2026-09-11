/**
 * The Mail page's own date-range options — the single source of truth for
 * which history is fetched from Zoho. Deliberately separate from
 * Recruitment's preset list (which serves a different purpose); nothing
 * here is stored per connection, and none of it affects automatic
 * new-mail scanning, which tracks its own cursor.
 */
export type MailDateRangePreset = "default" | "this_week" | "last_week" | "this_month" | "last_month" | "custom"

export const MAIL_DATE_RANGE_PRESETS: { value: MailDateRangePreset; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "custom", label: "Custom" },
]

export const DEFAULT_MAIL_DATE_RANGE_PRESET: MailDateRangePreset = "default"

export interface MailDateRange {
  from: string
  to: string
}

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/**
 * Resolves a preset (as of "now") to a concrete [from, to] ISO date pair.
 *
 * "This"/"Last" are calendar periods, not rolling windows — This Week runs
 * from Sunday to today, Last Week is the whole previous Sun–Sat, and the
 * month pair works the same way. Without that distinction a rolling "last
 * 7 days" would almost entirely overlap "This Week" and the two options
 * would be indistinguishable in practice.
 *
 * `custom` resolves only once both ends have been filled in.
 */
export function resolveMailDateRange(
  preset: MailDateRangePreset,
  custom?: { from?: string; to?: string }
): MailDateRange | null {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (preset) {
    case "custom":
      return custom?.from && custom?.to ? { from: custom.from, to: custom.to } : null

    case "default": {
      // The 15-day window the page opens on.
      const start = new Date(today)
      start.setDate(start.getDate() - 14) // inclusive of today = 15 days
      return { from: toIsoDate(start), to: toIsoDate(today) }
    }

    case "this_week": {
      const start = new Date(today)
      start.setDate(start.getDate() - start.getDay()) // back to Sunday
      return { from: toIsoDate(start), to: toIsoDate(today) }
    }

    case "last_week": {
      const start = new Date(today)
      start.setDate(start.getDate() - start.getDay() - 7) // previous Sunday
      const end = new Date(start)
      end.setDate(end.getDate() + 6) // that week's Saturday
      return { from: toIsoDate(start), to: toIsoDate(end) }
    }

    case "this_month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      return { from: toIsoDate(start), to: toIsoDate(today) }
    }

    case "last_month": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const end = new Date(today.getFullYear(), today.getMonth(), 0) // last day of previous month
      return { from: toIsoDate(start), to: toIsoDate(end) }
    }
  }
}

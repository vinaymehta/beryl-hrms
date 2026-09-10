export type DateRangePreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom"

export const DATE_RANGE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
]

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Resolves a preset (as of "now") to a concrete [from, to] ISO date pair. `custom` is only used for the "custom" preset. */
export function resolveDateRangePreset(
  preset: DateRangePreset,
  custom?: { from?: string; to?: string }
): { from: string; to: string } | null {
  const now = new Date()

  switch (preset) {
    case "today": {
      const s = startOfDay(now)
      return { from: toIsoDate(s), to: toIsoDate(s) }
    }
    case "yesterday": {
      const y = startOfDay(now)
      y.setDate(y.getDate() - 1)
      return { from: toIsoDate(y), to: toIsoDate(y) }
    }
    case "this_week": {
      const s = startOfDay(now)
      s.setDate(s.getDate() - s.getDay())
      return { from: toIsoDate(s), to: toIsoDate(now) }
    }
    case "last_week": {
      const s = startOfDay(now)
      s.setDate(s.getDate() - s.getDay() - 7)
      const e = new Date(s)
      e.setDate(e.getDate() + 6)
      return { from: toIsoDate(s), to: toIsoDate(e) }
    }
    case "this_month": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: toIsoDate(s), to: toIsoDate(now) }
    }
    case "last_month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const e = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: toIsoDate(s), to: toIsoDate(e) }
    }
    case "this_year": {
      const s = new Date(now.getFullYear(), 0, 1)
      return { from: toIsoDate(s), to: toIsoDate(now) }
    }
    case "custom":
      return custom?.from && custom?.to ? { from: custom.from, to: custom.to } : null
    default:
      return null
  }
}

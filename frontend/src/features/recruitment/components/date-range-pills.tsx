"use client"

import { CalendarIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { DATE_RANGE_PRESETS, resolveDateRangePreset, type DateRangePreset } from "../lib/date-range-presets"

interface DateRangePillsProps {
  preset: DateRangePreset | ""
  customFrom: string
  customTo: string
  onChange: (next: { preset: DateRangePreset | ""; customFrom: string; customTo: string; resolved: { from: string; to: string } | null }) => void
}

/**
 * Pill-button variant of the date-range picker (vs. date-range-filter.tsx's
 * compact dropdown, used in the space-constrained Resumes list filter bar) —
 * built for a roomier context like the Scan Mail panel. Same presets/
 * resolution logic underneath, just presented as a row of buttons plus
 * always-visible From/To fields instead of a select + conditional inputs.
 */
export function DateRangePills({ preset, customFrom, customTo, onChange }: DateRangePillsProps) {
  const resolved = preset && preset !== "custom" ? resolveDateRangePreset(preset) : null
  const fromValue = preset === "custom" ? customFrom : resolved?.from ?? ""
  const toValue = preset === "custom" ? customTo : resolved?.to ?? ""

  function selectPreset(next: DateRangePreset) {
    if (next === "custom") {
      const seedFrom = customFrom || fromValue
      const seedTo = customTo || toValue
      onChange({
        preset: "custom",
        customFrom: seedFrom,
        customTo: seedTo,
        resolved: resolveDateRangePreset("custom", { from: seedFrom, to: seedTo }),
      })
      return
    }
    onChange({ preset: next, customFrom: "", customTo: "", resolved: resolveDateRangePreset(next) })
  }

  function editDate(field: "customFrom" | "customTo", value: string) {
    const next = { customFrom: field === "customFrom" ? value : fromValue, customTo: field === "customTo" ? value : toValue }
    onChange({ preset: "custom", ...next, resolved: resolveDateRangePreset("custom", { from: next.customFrom, to: next.customTo }) })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {DATE_RANGE_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => selectPreset(p.value)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              preset === p.value
                ? "bg-role-recruitment text-role-recruitment-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            }`}
          >
            {p.value === "custom" && <CalendarIcon className="size-3.5" />}
            {p.label}
          </button>
        ))}
      </div>

      {/* Only shown once "Custom Range" is actually selected — these used to
          render unconditionally, so the From/To inputs were visible (and
          pre-filled by whichever preset was picked) before the user had
          ever asked for a custom range. */}
      {preset === "custom" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">From</label>
            <div className="relative">
              <CalendarIcon className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                type="date"
                value={fromValue}
                onChange={(e) => editDate("customFrom", e.target.value)}
                className="pl-8 text-xs bg-background"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">To</label>
            <div className="relative">
              <CalendarIcon className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                type="date"
                value={toValue}
                onChange={(e) => editDate("customTo", e.target.value)}
                className="pl-8 text-xs bg-background"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

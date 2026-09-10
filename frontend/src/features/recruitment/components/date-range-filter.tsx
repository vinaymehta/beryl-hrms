"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { DATE_RANGE_PRESETS, resolveDateRangePreset, type DateRangePreset } from "../lib/date-range-presets"

interface DateRangeFilterProps {
  preset: DateRangePreset | ""
  customFrom: string
  customTo: string
  onChange: (next: { preset: DateRangePreset | ""; customFrom: string; customTo: string; resolved: { from: string; to: string } | null }) => void
  /** When false, an empty/"all time" option is offered alongside the presets (used for the Resumes list filter, where no date filter is a valid state — the Zoho scan picker always requires a real range). */
  allowClear?: boolean
  className?: string
}

/**
 * One shared date-range control (presets + explicit From/To) used both by
 * the Zoho scan picker (which range of the mailbox to scan) and the Resumes
 * list filter (which range of already-imported resumes to display) — two
 * independent concepts that happen to share the same preset set.
 */
export function DateRangeFilter({ preset, customFrom, customTo, onChange, allowClear, className }: DateRangeFilterProps) {
  // Base UI's <Select.Value> only resolves the trigger's displayed label
  // via this `items` prop — without it, it falls back to showing the raw
  // value string (e.g. "this_week") instead of "This Week".
  const items = allowClear ? [{ value: "", label: "All time" }, ...DATE_RANGE_PRESETS] : DATE_RANGE_PRESETS

  function handlePresetChange(value: string | null) {
    if (!value) {
      onChange({ preset: "", customFrom: "", customTo: "", resolved: null })
      return
    }
    const next = value as DateRangePreset
    const resolved = next === "custom" ? resolveDateRangePreset(next, { from: customFrom, to: customTo }) : resolveDateRangePreset(next)
    onChange({ preset: next, customFrom, customTo, resolved })
  }

  function handleCustomChange(field: "customFrom" | "customTo", value: string) {
    const next = { customFrom, customTo, [field]: value }
    const resolved = resolveDateRangePreset("custom", { from: next.customFrom, to: next.customTo })
    onChange({ preset: "custom", ...next, resolved })
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <Select items={items} value={preset} onValueChange={handlePresetChange}>
        <SelectTrigger aria-label="Date range" className="h-8 w-40 text-xs">
          <SelectValue placeholder="Date range" />
        </SelectTrigger>
        <SelectContent>
          {allowClear && <SelectItem value="">All time</SelectItem>}
          {DATE_RANGE_PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === "custom" && (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => handleCustomChange("customFrom", e.target.value)}
            className="h-8 w-36 text-xs"
            aria-label="From date"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => handleCustomChange("customTo", e.target.value)}
            className="h-8 w-36 text-xs"
            aria-label="To date"
          />
        </div>
      )}
    </div>
  )
}

"use client"

import { CalendarIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  MAIL_DATE_RANGE_PRESETS,
  resolveMailDateRange,
  type MailDateRange,
  type MailDateRangePreset,
} from "@/features/mail/lib/mail-date-ranges"

interface MailDateFilterProps {
  preset: MailDateRangePreset
  customFrom: string
  customTo: string
  onChange: (next: {
    preset: MailDateRangePreset
    customFrom: string
    customTo: string
    resolved: MailDateRange | null
  }) => void
}

/** Picks which slice of mail history to fetch from Zoho. The From/To
 *  inputs only appear once "Custom" is chosen. */
export function MailDateFilter({ preset, customFrom, customTo, onChange }: MailDateFilterProps) {
  function handlePresetChange(value: string | null) {
    if (!value) return
    const next = value as MailDateRangePreset
    onChange({
      preset: next,
      customFrom,
      customTo,
      resolved: resolveMailDateRange(next, { from: customFrom, to: customTo }),
    })
  }

  function handleCustomChange(field: "customFrom" | "customTo", value: string) {
    const next = { customFrom, customTo, [field]: value }
    onChange({
      preset: "custom",
      ...next,
      resolved: resolveMailDateRange("custom", { from: next.customFrom, to: next.customTo }),
    })
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Select items={MAIL_DATE_RANGE_PRESETS} value={preset} onValueChange={handlePresetChange}>
        <SelectTrigger aria-label="Mail date range" className="h-8 w-44 text-xs">
          <SelectValue placeholder="Date range" />
        </SelectTrigger>
        <SelectContent>
          {MAIL_DATE_RANGE_PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Stacked, not side by side — two date inputs in a row make the
          popover wide and cramped; one above the other keeps it the same
          width as the preset select above them. */}
      {preset === "custom" && (
        <div className="flex flex-col gap-2">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">From</label>
            <div className="relative">
              <CalendarIcon className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => handleCustomChange("customFrom", e.target.value)}
                className="h-8 w-44 pl-8 text-xs"
                aria-label="From date"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">To</label>
            <div className="relative">
              <CalendarIcon className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                type="date"
                value={customTo}
                onChange={(e) => handleCustomChange("customTo", e.target.value)}
                className="h-8 w-44 pl-8 text-xs"
                aria-label="To date"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

"use client"

import { StarIcon } from "lucide-react"
import { cn } from "cn"

import { RATING_SCALE } from "@/features/appraisals/constants"
import type { TemplateImportRatingGuideRow } from "@/types/appraisals"

/**
 * The 1–5 scale as five stars.
 *
 * Replaces a row of five full-width labelled buttons, which took the whole
 * width of a card for one value and pushed the evidence box — the part that
 * actually takes thought — below the fold on every area. The wording it
 * carried isn't lost: it moves to the rating guide beside the field, where it
 * is readable once for all seven areas instead of repeated seven times.
 *
 * Still a real radiogroup: same roles, same keyboard behaviour, same
 * `N — Label` accessible names the old control exposed.
 */
export function RatingSelect({
  value,
  onChange,
  disabled,
  labelledBy,
  scale = RATING_SCALE,
}: {
  value: number | null
  onChange: (next: number) => void
  disabled?: boolean
  labelledBy?: string
  scale?: { value: number; label: string }[]
}) {
  const selected = scale.find((option) => option.value === value)

  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-0.5" role="radiogroup" aria-labelledby={labelledBy}>
        {scale.map((option) => {
          const active = value != null && option.value <= value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={value === option.value}
              aria-label={`${option.value} — ${option.label}`}
              disabled={disabled}
              title={option.label}
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-md p-1 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                disabled ? "cursor-not-allowed opacity-60" : "hover:bg-muted"
              )}
            >
              <StarIcon
                className={cn(
                  "size-6 transition-colors",
                  active ? "fill-role-hr text-role-hr" : "text-muted-foreground/40"
                )}
              />
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {selected ? (
          <span className="font-medium text-foreground">
            {selected.value} · {selected.label}
          </span>
        ) : (
          "Select a rating (1–5)"
        )}
      </p>
    </div>
  )
}

/**
 * The pill colour for each point on the scale, low to high.
 *
 * Complete literal strings, never assembled at runtime — Tailwind's scanner
 * only sees classes it can read in the source, the same constraint the role
 * and level badges work under.
 *
 * Keyed by position rather than by the number itself, so a workbook using a
 * 1–4 or 1–6 scale still runs red → amber → green across whatever it defines
 * instead of losing colour off the end.
 */
const RATING_PILL = [
  "bg-destructive/15 text-destructive ring-destructive/25",
  "bg-warning/15 text-warning ring-warning/25",
  "bg-info/15 text-info ring-info/25",
  "bg-success/15 text-success ring-success/25",
  "bg-success/25 text-success ring-success/40",
]

function pillClass(index: number, total: number) {
  if (total <= 1) return RATING_PILL[RATING_PILL.length - 1]

  // Spread whatever the scale's length is across the five steps.
  const step = Math.round((index / (total - 1)) * (RATING_PILL.length - 1))
  return RATING_PILL[Math.min(Math.max(step, 0), RATING_PILL.length - 1)]
}

/**
 * The scale's wording, shown once beside the field being rated.
 *
 * Prefers the rating guide the TEMPLATE's workbook defined; falls back to the
 * built-in scale for a template that was never imported from one.
 */
export function RatingGuide({ guide }: { guide?: TemplateImportRatingGuideRow[] | null }) {
  const rows =
    guide && guide.length > 0
      ? guide.map((row) => ({
          value: row.rating ?? 0,
          label: row.level ?? "",
          description: row.definition ?? "",
        }))
      : [...RATING_SCALE].reverse().map((row) => ({
          value: row.value,
          label: row.label,
          description: row.description,
        }))

  return (
    <div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
      <p className="text-center text-xs font-semibold text-foreground">Rating guide</p>
      <ul className="grid gap-1.5">
        {rows.map((row, index) => (
          <li key={row.value} className="flex items-start gap-2">
            {/* Rows run highest-first, so the colour index is reversed. */}
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ring-1",
                pillClass(rows.length - 1 - index, rows.length)
              )}
            >
              {row.value}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium text-foreground">{row.label}</span>
              {row.description && (
                <span className="block text-[11px] leading-snug text-muted-foreground">{row.description}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

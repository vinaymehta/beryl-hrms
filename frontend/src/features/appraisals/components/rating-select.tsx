"use client"

import { createContext, useContext, useRef, useState, type KeyboardEvent } from "react"
import { StarIcon } from "lucide-react"
import { cn } from "cn"

import {
  formatRating,
  RATING_SCALE,
  RATING_STEP,
  ratingLevel,
  type RatingScaleOption,
} from "@/features/appraisals/constants"
import type { TemplateImportRatingGuideRow } from "@/types/appraisals"

/**
 * The scale in force for the appraisal on screen — its template's own rating
 * guide (see ratingScaleFrom). Provided once by AppraisalWorkspace, so every
 * rating control and label below it follows the template instead of a
 * built-in list.
 */
export const RatingScaleContext = createContext<RatingScaleOption[]>(RATING_SCALE)

export function useRatingScale() {
  return useContext(RatingScaleContext)
}

/**
 * The scale as stars, one per level the template defines — each one selectable
 * as a half or a whole (AppraisalAnswer takes 1 to 5 in steps of 0.5).
 *
 * Replaces a row of five full-width labelled buttons, which took the whole
 * width of a card for one value and pushed the evidence box — the part that
 * actually takes thought — below the fold on every area. The wording it
 * carried isn't lost: it moves to the rating guide beside the field, where it
 * is readable once for all seven areas instead of repeated seven times.
 *
 * Every star after the first is two radios laid over its two halves: the left
 * half is the half step below the level (3.5 on the fourth star), the right
 * half the level itself (4). That is what makes a tap on a phone pick a half
 * as reliably as a mouse, with no reading of pointer coordinates. The first
 * star has only the whole: the scale starts at a full 1, so its left half
 * selects 1 too.
 *
 * Still a real radiogroup — one radio per half step, `N — Label` accessible
 * names, a single Tab stop on the checked radio, and the arrow keys moving by
 * half a star (Home / End jump to the ends), the way a native radio group
 * moves and selects together.
 */
export function RatingSelect({
  value,
  onChange,
  disabled,
  labelledBy,
  scale: scaleProp,
}: {
  value: number | null
  onChange: (next: number) => void
  disabled?: boolean
  labelledBy?: string
  scale?: { value: number; label: string }[]
}) {
  const contextScale = useRatingScale()
  const scale = scaleProp ?? contextScale
  // Previewed under the pointer before it is chosen; never what is stored.
  const [hovered, setHovered] = useState<number | null>(null)
  const radios = useRef(new Map<number, HTMLButtonElement>())

  // Every value the control can take, low to high: the first level whole,
  // then the half step before each level after it — 1, 1.5, 2 … 4.5, 5.
  const steps = scale.flatMap((option, index) =>
    index === 0 ? [option.value] : [option.value - RATING_STEP, option.value]
  )
  const max = scale.at(-1)?.value ?? 5
  const shown = hovered ?? value
  const level = ratingLevel(scale, shown)
  // Roving tabindex: Tab lands on the checked radio, or the first one.
  const tabStop = value != null && steps.includes(value) ? value : steps[0]

  function describe(step: number) {
    const own = ratingLevel(scale, step)?.label
    if (Number.isInteger(step)) return `${formatRating(step)} — ${own ?? ""}`
    const next = scale.find((option) => option.value === step + RATING_STEP)?.label
    return `${formatRating(step)} — between ${own ?? ""} and ${next ?? ""}`
  }

  function select(step: number) {
    onChange(step)
    radios.current.get(step)?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = value == null ? -1 : steps.indexOf(value)
    let next: number | undefined
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = steps[Math.min(index + 1, steps.length - 1)]
        break
      case "ArrowLeft":
      case "ArrowDown":
        next = steps[Math.max(index - 1, 0)]
        break
      case "Home":
        next = steps[0]
        break
      case "End":
        next = steps.at(-1)
        break
      default:
        return
    }
    event.preventDefault()
    if (next != null) select(next)
  }

  return (
    <div className="grid gap-1">
      <div
        className="flex items-center gap-4 sm:gap-7"
        role="radiogroup"
        aria-labelledby={labelledBy}
        aria-disabled={disabled || undefined}
        onKeyDown={handleKeyDown}
        onPointerLeave={() => setHovered(null)}
      >
        {scale.map((option, index) => {
          const half = option.value - RATING_STEP
          const fill =
            shown == null ? 0 : shown >= option.value ? 1 : index > 0 && shown >= half ? 0.5 : 0
          return (
            <span
              key={option.value}
              className={cn(
                "relative rounded-md p-1 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                disabled ? "cursor-not-allowed opacity-60" : "hover:bg-muted"
              )}
            >
              <StarIcon aria-hidden className="size-10 text-muted-foreground/40 transition-colors" />
              {/* The filled star over the outline one, clipped to its left
                  half for a half rating. */}
              {fill > 0 && (
                <StarIcon
                  aria-hidden
                  className={cn(
                    "absolute top-1 left-1 size-10 fill-role-hr text-role-hr transition-colors",
                    fill === 0.5 && "[clip-path:inset(0_50%_0_0)]"
                  )}
                />
              )}
              <span className="absolute inset-0 flex">
                {(index === 0 ? [option.value] : [half, option.value]).map((step) => (
                  <button
                    key={step}
                    ref={(node) => {
                      if (node) radios.current.set(step, node)
                      else radios.current.delete(step)
                    }}
                    type="button"
                    role="radio"
                    aria-checked={value === step}
                    aria-label={describe(step)}
                    title={describe(step)}
                    tabIndex={step === tabStop ? 0 : -1}
                    disabled={disabled}
                    onClick={() => select(step)}
                    onPointerEnter={() => !disabled && setHovered(step)}
                    className="h-full flex-1 focus-visible:outline-none disabled:cursor-not-allowed"
                  />
                ))}
              </span>
            </span>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {shown != null ? (
          <span className="font-medium text-foreground">
            {formatRating(shown)} / {max}
            {level && ` · ${level.label}`}
          </span>
        ) : (
          `Select a rating (${scale[0]?.value ?? 1}–${max}, half stars allowed)`
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
      <p className="text-center text-[11px] text-muted-foreground">
        Half stars sit between two levels — the left half of the fourth star is 3.5.
      </p>
    </div>
  )
}

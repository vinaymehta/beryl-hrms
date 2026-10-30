"use client"

import { useState } from "react"
import { AlertCircleIcon, MessageSquareIcon, StarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { InterviewDecision, InterviewFeedbackInput } from "@/types/recruitment"
import { DECISION_META, DECISION_OPTIONS, FEEDBACK_AREAS, RATING_LABELS } from "../lib/interview-feedback"
import { cn } from "cn"

const TEXT_LIMIT = 2000

type Ratings = Record<(typeof FEEDBACK_AREAS)[number]["key"] | "overallRating", number>

const EMPTY_RATINGS: Ratings = {
  technicalRating: 0,
  communicationRating: 0,
  problemSolvingRating: 0,
  cultureFitRating: 0,
  overallRating: 0,
}

function RatingPicker({
  label,
  value,
  onChange,
  large = false,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  large?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label className={cn(!large && "text-xs font-medium")}>{label}</Label>
        <span className="text-xs text-muted-foreground">{value > 0 ? RATING_LABELS[value - 1] : ""}</span>
      </div>
      <div className="flex items-center gap-1.5" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} out of 5 — ${RATING_LABELS[n - 1]}`}
            onClick={() => onChange(n)}
            className={cn(
              "flex items-center justify-center rounded-lg border transition-colors",
              large ? "size-11" : "size-9",
              n <= value
                ? "border-warning/40 bg-warning/10 text-warning"
                : "text-muted-foreground/40 hover:bg-muted/50"
            )}
          >
            <StarIcon className={cn(large ? "size-5" : "size-4", n <= value && "fill-current")} />
          </button>
        ))}
      </div>
    </div>
  )
}

function TextArea({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        maxLength={TEXT_LIMIT}
        placeholder={placeholder}
        className="w-full resize-y rounded-lg border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  )
}

/**
 * The structured interviewer write-up — shared by the public token page and
 * the in-app My interviews page so both collect exactly the same thing. Every
 * rating and the decision are required (the backend enforces the same); the
 * text fields are optional.
 */
export function InterviewFeedbackForm({
  onSubmit,
  isPending,
  error,
}: {
  onSubmit: (values: InterviewFeedbackInput) => void
  isPending: boolean
  error: unknown
}) {
  const [ratings, setRatings] = useState<Ratings>(EMPTY_RATINGS)
  const [decision, setDecision] = useState<InterviewDecision | null>(null)
  const [strengths, setStrengths] = useState("")
  const [weaknesses, setWeaknesses] = useState("")
  const [comments, setComments] = useState("")

  const setRating = (key: keyof Ratings) => (n: number) => setRatings((r) => ({ ...r, [key]: n }))
  const complete = Object.values(ratings).every((n) => n > 0) && decision !== null

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ratings</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {FEEDBACK_AREAS.map((area) => (
            <RatingPicker key={area.key} label={area.label} value={ratings[area.key]} onChange={setRating(area.key)} />
          ))}
        </div>
      </div>

      <TextArea
        id="feedback-strengths"
        label="Strengths"
        value={strengths}
        onChange={setStrengths}
        placeholder="What stood out positively?"
      />
      <TextArea
        id="feedback-weaknesses"
        label="Weaknesses"
        value={weaknesses}
        onChange={setWeaknesses}
        placeholder="Gaps or concerns the hiring team should know about."
      />
      <TextArea
        id="feedback-comments"
        label="Overall comments"
        value={comments}
        onChange={setComments}
        placeholder="Anything else worth recording."
      />

      <RatingPicker label="Overall rating" value={ratings.overallRating} onChange={setRating("overallRating")} large />

      <div className="space-y-2">
        <Label>Decision</Label>
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Decision">
          {DECISION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={decision === opt.value}
              onClick={() => setDecision(opt.value)}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                decision === opt.value ? DECISION_META[opt.value].className : "text-muted-foreground hover:bg-muted/50"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {/* Advisory — the spec forbids feedback auto-selecting or
            auto-rejecting anyone. */}
        <p className="text-xs text-muted-foreground">
          Recorded for the hiring team to review. It does not select or reject the candidate on its own.
        </p>
      </div>

      {error != null && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
          <p>{error instanceof Error ? error.message : "Something went wrong. Please try again."}</p>
        </div>
      )}

      <div className="space-y-2">
        <Button
          onClick={() =>
            decision &&
            onSubmit({ ...ratings, decision, strengths: strengths.trim(), weaknesses: weaknesses.trim(), comments: comments.trim() })
          }
          disabled={!complete || isPending}
          className="w-full gap-1.5"
          size="lg"
        >
          <MessageSquareIcon className="size-4" />
          {isPending ? "Sending…" : "Submit feedback"}
        </Button>
        {!complete && (
          <p className="text-center text-xs text-muted-foreground">
            Rate all four areas, give an overall rating and pick a decision to continue.
          </p>
        )}
      </div>
    </div>
  )
}

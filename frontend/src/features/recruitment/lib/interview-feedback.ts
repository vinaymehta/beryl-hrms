import type { InterviewDecision, InterviewFeedback, InterviewStage } from "@/types/recruitment"

export const RATING_LABELS = ["Poor", "Fair", "Good", "Strong", "Outstanding"]

/** The four scored areas on the structured form, in display order. */
export const FEEDBACK_AREAS: { key: keyof InterviewFeedback & `${string}Rating`; label: string }[] = [
  { key: "technicalRating", label: "Technical skills" },
  { key: "communicationRating", label: "Communication" },
  { key: "problemSolvingRating", label: "Problem solving" },
  { key: "cultureFitRating", label: "Attitude / culture fit" },
]

export const DECISION_META: Record<InterviewDecision, { label: string; className: string }> = {
  hire: { label: "Hire", className: "border-success/30 bg-success/10 text-success" },
  next_round: { label: "Next round", className: "border-primary/30 bg-primary/10 text-primary" },
  hold: { label: "Hold", className: "border-warning/30 bg-warning/10 text-warning" },
  no_hire: { label: "No hire", className: "border-destructive/30 bg-destructive/10 text-destructive" },
}

export const DECISION_OPTIONS = (Object.keys(DECISION_META) as InterviewDecision[]).map((value) => ({
  value,
  label: DECISION_META[value].label,
}))

export const INTERVIEW_STAGE_META: Record<InterviewStage, { label: string; className: string }> = {
  scheduled: { label: "Scheduled", className: "border-primary/30 bg-primary/10 text-primary" },
  today: { label: "Today", className: "border-role-recruitment/30 bg-role-recruitment/10 text-role-recruitment" },
  completed: { label: "Completed", className: "border-success/30 bg-success/10 text-success" },
  not_booked: { label: "Not booked", className: "border-border bg-muted/50 text-muted-foreground" },
  no_interviewer: { label: "No interviewer", className: "border-warning/30 bg-warning/10 text-warning" },
}

/** Interviews are booked and read in IST, whatever the viewer's own zone. */
export function formatIst(iso: string | null | undefined, style: "datetime" | "date" = "datetime") {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    ...(style === "datetime" ? { timeStyle: "short" } : {}),
  })
}

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86400],
  ["month", 30 * 86400],
  ["week", 7 * 86400],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
]

/** "in 2 days", "3 weeks ago" — the rough distance from now. */
export function relativeTime(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  const seconds = (t - now) / 1000
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) return RELATIVE.format(Math.round(seconds / size), unit)
  }
  return "just now"
}

/** "3 yrs · Acme Corp" — the one-line summary under a candidate's name. */
export function experienceLine(profile: { experienceYears: number; currentCompany: string | null }) {
  const years = profile.experienceYears
  return [`${years} yr${years === 1 ? "" : "s"}`, profile.currentCompany].filter(Boolean).join(" · ")
}

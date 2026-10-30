import { API_ORIGIN } from "@/lib/api-client"
import type { JobOpening } from "@/types/job-openings"

/** "5 Oct 2026". Parsed as a local date: `new Date("2026-10-05")` is UTC midnight. */
export function postedDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

/** Distinct non-blank values of a field across the openings, most used first. */
export function distinctValues(openings: JobOpening[], field: "category" | "employmentType" | "location") {
  const counts = new Map<string, number>()
  for (const opening of openings) {
    const value = opening[field].trim()
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([value]) => value)
}

/** "30 Oct 2026, 14:05" — for created/updated timestamps. */
export function dateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Where the careers website reads this opening from. API_ORIGIN is empty when
 * one web server fronts both app and API, so the page's own origin is used.
 */
export function publicApiUrl(slug: string) {
  const origin = API_ORIGIN || (typeof window === "undefined" ? "" : window.location.origin)
  return `${origin}/api/v1/public/job_openings/${slug}`
}

/** The opening's path on the careers website. The website owns the prefix; this is the app's best guess. */
export function careersPath(slug: string) {
  return `/careers/${slug || "…"}`
}

/** Recruitment → Resumes, filtered to the applications sent for this opening. */
export function applicationsHref(id: number) {
  return `/recruitment?jobOpeningId=${id}`
}

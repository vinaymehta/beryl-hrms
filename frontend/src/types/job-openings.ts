/**
 * An opening on the public careers website (backend JobOpening) — Job
 * Administration's camelCase view of it. Unrelated to recruitment `Job`.
 */
export interface JobOpening {
  id: number
  code: string
  slug: string
  title: string
  category: string
  employmentType: string
  location: string
  /** YYYY-MM-DD */
  datePosted: string
  summary: string
  intro: string
  about: string
  responsibilities: string[]
  requirements: string[]
  niceToHave: string[]
  growthHeading: string
  growthItems: string[]
  roleQuestion: string
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
  /** Applications received through the careers website. */
  applicationsCount: number
}

/** What the form sends. A blank code or slug is filled in by the server. */
export type JobOpeningInput = Omit<JobOpening, "id" | "sortOrder" | "createdAt" | "updatedAt" | "applicationsCount">

export interface JobOpeningIdentifiers {
  code: string
  slug: string
  /** Whether the code/slug asked about is free — null when none was asked about. */
  codeAvailable: boolean | null
  slugAvailable: boolean | null
}

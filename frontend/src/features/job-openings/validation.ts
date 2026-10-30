/**
 * The form's checks — kept in step with JobOpening's validations on the
 * backend, which remain the real rule (and also decide uniqueness).
 */
export const LIMITS = {
  code: 40,
  slug: 100,
  title: 150,
  category: 60,
  employmentType: 60,
  location: 120,
  summary: 500,
  intro: 1000,
  about: 4000,
  growthHeading: 120,
  roleQuestion: 500,
} as const

export const LIST_ITEM_MAX = 500
export const LIST_SIZE_MAX = 20

export const CODE_FORMAT = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/
export const SLUG_FORMAT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Internship", "Contract"]

export const REQUIRED: { field: keyof typeof LIMITS | "datePosted"; label: string }[] = [
  { field: "title", label: "Title" },
  { field: "category", label: "Category" },
  { field: "employmentType", label: "Employment type" },
  { field: "location", label: "Location" },
  { field: "datePosted", label: "Date posted" },
  { field: "summary", label: "Summary" },
  { field: "intro", label: "Intro" },
  { field: "about", label: "About the role" },
  { field: "growthHeading", label: "Growth heading" },
]

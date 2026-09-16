export interface EmployeeDocument {
  id: string
  /** Display name — falls back to the uploaded filename when none was given. */
  title: string
  fileName: string
  /** Category key from DOCUMENT_CATEGORIES; "other" carries customCategory. */
  documentType: string
  customCategory: string | null
  employeeId: string | null
  employeeName: string | null
  /** Who uploaded it — what the delete rule keys on, not whose record it's on. */
  uploadedById: string | null
  byteSize: number
  contentType: string | null
  createdAt: string
}

/**
 * The categories offered at upload. Keys are what the backend stores
 * (Document::CATEGORIES) and must match it exactly; labels are display-only,
 * so rewording one here never touches stored data.
 */
export const DOCUMENT_CATEGORIES: { value: string; label: string }[] = [
  { value: "aadhaar", label: "Aadhaar" },
  { value: "pan", label: "PAN" },
  { value: "resume", label: "Resume" },
  { value: "offer_letter", label: "Offer Letter" },
  { value: "employment_contract", label: "Employment Contract" },
  { value: "education_certificate", label: "Education Certificate" },
  { value: "experience_certificate", label: "Experience Certificate" },
  { value: "bank_document", label: "Bank Document" },
  { value: "other", label: "Other" },
]

export const OTHER_CATEGORY = "other"

/** What to show in the Category column: the typed name for "Other". */
export function categoryLabel(document: EmployeeDocument): string {
  if (document.documentType === OTHER_CATEGORY) return document.customCategory || "Other"
  return DOCUMENT_CATEGORIES.find((c) => c.value === document.documentType)?.label ?? document.documentType
}

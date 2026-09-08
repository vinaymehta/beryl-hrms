/** Matches the Rails API envelope — see docs/API_CONVENTIONS.md. */
export interface ApiSuccess<T> {
  data: T
}

export interface ApiErrorItem {
  code: string
  message: string
  field?: string
}

export interface ApiErrorBody {
  errors: ApiErrorItem[]
}

export interface PaginationMeta {
  page: number
  perPage: number
  totalPages: number
  totalCount: number
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

export class ApiError extends Error {
  readonly status: number
  readonly errors: ApiErrorItem[]

  constructor(status: number, errors: ApiErrorItem[]) {
    super(errors[0]?.message ?? `Request failed with status ${status}`)
    this.name = "ApiError"
    this.status = status
    this.errors = errors
  }

  /** Convenience: first field-level error message for a given field, if any. */
  fieldError(field: string): string | undefined {
    return this.errors.find((e) => e.field === field)?.message
  }
}

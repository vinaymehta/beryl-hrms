import { ApiError, type ApiErrorBody } from "@/types/api"
import { readCookie } from "@/lib/cookies"

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/v1`

// Confirmed against the backend's CsrfProtection concern
// (app/controllers/concerns/csrf_protection.rb): cookie name is the literal
// Rails cookie key `csrf_token`, header is `X-CSRF-Token`.
const CSRF_COOKIE_NAME = "csrf_token"
const CSRF_HEADER_NAME = "X-CSRF-Token"

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  unwrap: boolean = true
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase()
  const headers = new Headers(options.headers)
  headers.set("Accept", "application/json")

  let body: BodyInit | undefined
  if (options.body instanceof FormData) {
    // Don't set Content-Type ourselves — the browser fills in the correct
    // multipart boundary only when it sets the header itself.
    body = options.body
  } else if (options.body !== undefined) {
    headers.set("Content-Type", "application/json")
    body = JSON.stringify(options.body)
  }

  if (MUTATING_METHODS.has(method)) {
    const token = readCookie(CSRF_COOKIE_NAME)
    if (token) headers.set(CSRF_HEADER_NAME, token)
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    method,
    headers,
    body,
    credentials: "include",
  })

  if (response.status === 204) return undefined as T

  const json = await response.json().catch(() => null)

  if (!response.ok) {
    const errorBody = json as ApiErrorBody | null
    throw new ApiError(
      response.status,
      errorBody?.errors ?? [
        { code: "unknown_error", message: response.statusText || "Request failed" },
      ]
    )
  }

  if (!unwrap) return json as T
  return (json?.data ?? json) as T
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  /** For file uploads — pass a FormData body, e.g. for document upload. */
  postForm: <T>(path: string, body: FormData, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
  /**
   * Returns the full envelope unwrapped ({data, meta}) instead of just
   * `.data` — for paginated list endpoints where callers need `meta` too.
   * Every other method above assumes callers only ever want the inner
   * `data`, which loses pagination metadata; this is the escape hatch.
   */
  getPaginated: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }, false),
}

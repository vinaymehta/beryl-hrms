import { ApiError } from "@/types/api"

/**
 * The message to actually show someone when a request fails.
 *
 * Only an ApiError carries a message written for a human — it comes from the
 * backend's `errors[].message`. Everything else that lands in a catch block is
 * a runtime or network failure whose message is written for a developer
 * ("Failed to fetch", "Unexpected token < in JSON"), so those get the caller's
 * fallback instead of being shown raw.
 *
 * This replaces the `catch (err: any) { toast.error(err?.message || "...") }`
 * pattern, which was both untyped and prone to putting internal wording in
 * front of users.
 */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

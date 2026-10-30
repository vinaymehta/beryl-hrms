import { apiClient } from "@/lib/api-client"
import type { JobOpening, JobOpeningIdentifiers, JobOpeningInput } from "@/types/job-openings"

export const jobOpeningsApi = {
  /** Every opening, paused ones included, in the website's order. */
  list: () => apiClient.get<JobOpening[]>("/job_openings"),
  get: (id: number) => apiClient.get<JobOpening>(`/job_openings/${id}`),
  create: (input: JobOpeningInput) => apiClient.post<JobOpening>("/job_openings", input),
  update: (id: number, input: Partial<JobOpeningInput>) => apiClient.patch<JobOpening>(`/job_openings/${id}`, input),
  remove: (id: number) => apiClient.delete<void>(`/job_openings/${id}`),
  activate: (id: number) => apiClient.patch<JobOpening>(`/job_openings/${id}/activate`),
  pause: (id: number) => apiClient.patch<JobOpening>(`/job_openings/${id}/pause`),
  /** A paused copy at the end of the list, with its own code and slug. */
  duplicate: (id: number) => apiClient.post<JobOpening>(`/job_openings/${id}/duplicate`),
  /** Every id, in the new order. Answers with the reordered list. */
  reorder: (ids: number[]) => apiClient.patch<JobOpening[]>("/job_openings/reorder", { ids }),
  /**
   * The code and slug the server would give this title and category, and
   * whether the `code`/`slug` typed are free. `exceptId` is the opening being
   * edited, whose own values count as free.
   */
  suggestIdentifiers: (params: { title: string; category: string; code?: string; slug?: string; exceptId?: number }) => {
    const q = new URLSearchParams({ title: params.title, category: params.category })
    if (params.code) q.set("code", params.code)
    if (params.slug) q.set("slug", params.slug)
    if (params.exceptId) q.set("exceptId", String(params.exceptId))
    return apiClient.get<JobOpeningIdentifiers>(`/job_openings/suggest_identifiers?${q}`)
  },
}

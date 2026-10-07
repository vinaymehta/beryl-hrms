import { apiClient, API_BASE } from "@/lib/api-client"
import { ApiError, type ApiErrorBody } from "@/types/api"
import type {
  AppraisalTemplate,
  AppraisalCycle,
  AppraisalCycleDetail,
  AppraisalSummary,
  AppraisalDetail,
  AppraisalListParams,
  AppNotification,
  CompensationBreakdown,
  ImportPreview,
  TemplateImportPreview,
  Calibration,
  PageMeta,
} from "@/types/appraisals"

function toQuery(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
  if (!entries.length) return ""
  return `?${new URLSearchParams(entries as [string, string][]).toString()}`
}

export const appraisalTemplatesApi = {
  list: (status?: string) => apiClient.get<AppraisalTemplate[]>(`/appraisal_templates${toQuery({ status })}`),
  get: (id: string) => apiClient.get<AppraisalTemplate>(`/appraisal_templates/${id}`),
  create: (values: unknown) => apiClient.post<AppraisalTemplate>("/appraisal_templates", values),
  update: (id: string, values: unknown) => apiClient.patch<AppraisalTemplate>(`/appraisal_templates/${id}`, values),
  /** The supported way to change a template history depends on. */
  newVersion: (id: string, name?: string) =>
    apiClient.post<AppraisalTemplate>(`/appraisal_templates/${id}/new_version`, { name }),
  activate: (id: string) => apiClient.patch<AppraisalTemplate>(`/appraisal_templates/${id}/activate`, {}),
  /**
   * Archives rather than destroying — a cycle that ran against a template must
   * keep resolving to it. The list hides archived templates, so from here it
   * reads as a delete; one a cycle has actually used is refused outright.
   */
  remove: (id: string) => apiClient.delete<void>(`/appraisal_templates/${id}`),
  /**
   * Upload → Validate → Parse → Preview. Writes nothing: the parsed categories
   * come back into the builder, where they are reviewed and then created
   * through `create` like any hand-built template.
   */
  importPreview: (file: File) => {
    const form = new FormData()
    form.append("file", file)
    return apiClient.postForm<TemplateImportPreview>("/appraisal_templates/import_preview", form)
  },
  /** The blank workbook, streamed — so it bypasses the JSON client. */
  importFormatUrl: () => `${API_BASE}/appraisal_templates/import_format`,
  archive: (id: string) => apiClient.delete<void>(`/appraisal_templates/${id}`),
}

export const appraisalCyclesApi = {
  list: (status?: string) => apiClient.get<AppraisalCycle[]>(`/appraisal_cycles${toQuery({ status })}`),
  get: (id: string) => apiClient.get<AppraisalCycleDetail>(`/appraisal_cycles/${id}`),
  create: (values: unknown) => apiClient.post<AppraisalCycle>("/appraisal_cycles", values),
  update: (id: string, values: unknown) => apiClient.patch<AppraisalCycle>(`/appraisal_cycles/${id}`, values),
  /** Instantiates one appraisal per eligible employee and opens self-appraisals. */
  start: (id: string) => apiClient.post<AppraisalCycleDetail>(`/appraisal_cycles/${id}/start`, {}),
  close: (id: string) => apiClient.patch<AppraisalCycle>(`/appraisal_cycles/${id}/close`, {}),
  reopen: (id: string) => apiClient.patch<AppraisalCycle>(`/appraisal_cycles/${id}/reopen`, {}),
  /** §16 — the organisation-level view a Final Reviewer calibrates from. */
  calibration: (id: string) => apiClient.get<Calibration>(`/appraisal_cycles/${id}/calibration`),
  remove: (id: string) => apiClient.delete<void>(`/appraisal_cycles/${id}`),
}

export const appraisalsApi = {
  // Paginated on the server. The whole list is never fetched to slice in the
  // browser — a company with two thousand employees has two thousand
  // appraisals per cycle.
  list: (params: AppraisalListParams = {}) =>
    apiClient.getPaginated<{ data: AppraisalSummary[]; meta: PageMeta }>(
      `/appraisals${toQuery(params as Record<string, string | number | undefined>)}`
    ),
  get: (id: string) => apiClient.get<AppraisalDetail>(`/appraisals/${id}`),
  submitSelf: (id: string, values: unknown) => apiClient.post<AppraisalDetail>(`/appraisals/${id}/submit_self`, values),
  /**
   * Work in progress, saved as the employee moves through the steps. Mutable
   * and unversioned, unlike `submitSelf` which mints the immutable V1.
   */
  saveDraft: (id: string, values: unknown) => apiClient.patch<AppraisalDetail>(`/appraisals/${id}/save_draft`, values),
  // Admin/HR's decision at the Discussion step: the monthly gross, its
  // breakdown into the letter's table, the dates, and any promotion.
  saveDiscussion: (
    id: string,
    values: {
      currentCompensation: string
      incrementPercentage: string
      approvedCompensation: string
      breakdown: Record<keyof CompensationBreakdown, number>
      effectiveDate: string
      nextAppraisalOn: string
      promote: boolean | null
      proposedDesignationId: string
      promotionReason: string
    }
  ) => apiClient.patch<AppraisalDetail>(`/appraisals/${id}/discussion`, values),
  // A reviewer's own draft at their stage — never the employee's.
  saveReviewDraft: (id: string, values: unknown) =>
    apiClient.patch<AppraisalDetail>(`/appraisals/${id}/save_review_draft`, values),
  submitReview: (id: string, values: unknown) =>
    apiClient.post<AppraisalDetail>(`/appraisals/${id}/submit_review`, values),
  advance: (id: string, to: string, notes?: string) =>
    apiClient.patch<AppraisalDetail>(`/appraisals/${id}/advance`, { to, notes }),
  returnForCorrection: (id: string, notes?: string) =>
    apiClient.patch<AppraisalDetail>(`/appraisals/${id}/return_for_correction`, { notes }),
  overrideScore: (id: string, score: number, reason: string) =>
    apiClient.patch<AppraisalDetail>(`/appraisals/${id}/override_score`, { score, reason }),
  release: (id: string, notes?: string) => apiClient.patch<AppraisalDetail>(`/appraisals/${id}/release`, { notes }),
  /**
   * The employee signs their letter: multipart, with the signature image,
   * `accept` and how the signature was made (drawn / uploaded).
   */
  sign: (id: string, form: FormData) => apiClient.patchForm<AppraisalDetail>(`/appraisals/${id}/sign`, form),
  /**
   * The letter PDF — the signed copy once there is one. `draft` is Admin/HR's
   * preview of the saved decision before release; `download` asks for an
   * attachment rather than inline.
   */
  letterUrl: (id: string, options: { draft?: boolean; download?: boolean } = {}) =>
    `${API_BASE}/appraisals/${id}/letter${toQuery({
      draft: options.draft ? "1" : undefined,
      download: options.download ? "1" : undefined,
    })}`,
  /**
   * The same PDF as a Blob, for the in-page preview. Fetched rather than
   * pointed at by the iframe so the frame is same-origin with the app (the
   * API's own frame headers never come into it) and a refusal arrives as the
   * API's message instead of a JSON page inside the frame.
   */
  letterBlob: async (id: string, options: { draft?: boolean } = {}) => {
    const response = await fetch(appraisalsApi.letterUrl(id, { draft: options.draft }), {
      credentials: "include",
      headers: { Accept: "application/pdf, application/json" },
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as ApiErrorBody | null
      throw new ApiError(
        response.status,
        body?.errors ?? [{ code: "unknown_error", message: response.statusText || "Request failed" }]
      )
    }
    return response.blob()
  },
  addComment: (id: string, values: unknown) => apiClient.post<AppraisalDetail>(`/appraisals/${id}/add_comment`, values),
  /** The offline workbook (§10.1). Streamed, so it bypasses the JSON client. */
  exportUrl: (id: string) => `${API_BASE}/appraisals/${id}/export`,
  /**
   * Upload → Validate → Parse → Preview. Saves nothing: the parsed rows come
   * back for the employee to confirm, and only their ordinary submit writes.
   */
  importPreview: (id: string, file: File) => {
    const form = new FormData()
    form.append("file", file)
    return apiClient.postForm<ImportPreview>(`/appraisals/${id}/import_preview`, form)
  },
}

export const notificationsApi = {
  list: () =>
    apiClient.getPaginated<{ data: AppNotification[]; meta: { unreadCount: number } }>("/notifications"),
  markRead: (id: string) => apiClient.patch<AppNotification>(`/notifications/${id}`, {}),
  markAllRead: () => apiClient.patch<void>("/notifications/mark_all_read", {}),
}

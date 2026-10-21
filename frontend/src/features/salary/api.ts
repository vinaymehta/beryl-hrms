import { API_BASE, apiClient } from "@/lib/api-client"
import type { SalaryGenerateBatch, SalaryRun, SalarySendBatch } from "@/types/salary"

export const salaryApi = {
  /** `month` is YYYY-MM. */
  run: (month: string) => apiClient.get<SalaryRun>(`/salary/run?month=${encodeURIComponent(month)}`),
  /**
   * Generates (or regenerates) each employee's slip. A slip that was already
   * sent is only replaced with `regenerate`, and goes back to Generated.
   */
  generate: (month: string, employeeIds: number[], regenerate = false) =>
    apiClient.post<SalaryGenerateBatch>("/salary/slips/generate", { month, employeeIds, regenerate }),
  /** Queues the stored PDFs for email. A sent slip only goes again with `resend`. */
  send: (slipIds: number[], resend = false) =>
    apiClient.post<SalarySendBatch>("/salary/slips/send", { slipIds, resend }),
  /**
   * The stored PDF. `version` (the slip's generatedAt) changes the URL when
   * the slip is regenerated, so the viewer never shows the previous one.
   */
  pdfUrl: (slipId: number, options: { download?: boolean; version?: string } = {}) => {
    const query = new URLSearchParams()
    if (options.download) query.set("download", "1")
    if (options.version) query.set("v", options.version)
    const suffix = query.size ? `?${query}` : ""
    return `${API_BASE}/salary/slips/${slipId}/pdf${suffix}`
  },
}

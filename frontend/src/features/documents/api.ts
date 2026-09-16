import { apiClient, API_BASE } from "@/lib/api-client"
import type { EmployeeDocument } from "@/types/documents"

export interface UploadDocumentInput {
  file: File
  /** Category key — required by the backend, which rejects anything off the list. */
  documentType: string
  /** Only when documentType is "other"; the backend rejects it otherwise. */
  customCategory?: string
  /** Whose record to file it against. Employees may only pass their own. */
  employeeId?: string
  /** Optional; the backend falls back to the filename. */
  title?: string
}

export const documentsApi = {
  // employeeId narrows an already-authorized list — DocumentPolicy::Scope has
  // decided what this viewer may see before the filter is applied, so it can
  // never widen access.
  list: (employeeId?: string) =>
    apiClient.get<EmployeeDocument[]>(
      employeeId ? `/documents?employeeId=${encodeURIComponent(employeeId)}` : "/documents"
    ),

  upload: ({ file, documentType, customCategory, employeeId, title }: UploadDocumentInput) => {
    const form = new FormData()
    form.append("file", file)
    form.append("document_type", documentType)
    if (customCategory) form.append("custom_category", customCategory)
    if (employeeId) form.append("employee_id", employeeId)
    if (title) form.append("title", title)
    return apiClient.postForm<EmployeeDocument>("/documents", form)
  },

  delete: (id: string) => apiClient.delete<void>(`/documents/${id}`),

  // Saves the file — Content-Disposition: attachment on the backend.
  downloadUrl: (id: string) => `${API_BASE}/documents/${id}/download`,

  // Renders it in the browser instead: same bytes, served inline with the
  // content type resolved from the filename. Pointing a preview at
  // downloadUrl is what makes a preview save the file rather than show it.
  previewUrl: (id: string) => `${API_BASE}/documents/${id}/preview`,
}

import { apiClient, API_BASE } from "@/lib/api-client"
import type { EmployeeDocument } from "@/types/documents"

// GUESS: exact backend contract not confirmed against a live backend (built
// separately). Download isn't fetched via apiClient — it's a plain
// authenticated GET the browser navigates to directly, which the backend
// redirects to a short-expiry signed storage URL (see docs/ARCHITECTURE.md
// "File storage" — never a public bucket URL).
export const documentsApi = {
  list: () => apiClient.get<EmployeeDocument[]>("/documents"),
  upload: (file: File, documentType: string) => {
    const form = new FormData()
    form.append("file", file)
    form.append("document_type", documentType)
    return apiClient.postForm<EmployeeDocument>("/documents", form)
  },
  delete: (id: string) => apiClient.delete<void>(`/documents/${id}`),
  downloadUrl: (id: string) =>
    `${API_BASE}/documents/${id}/download`,
}

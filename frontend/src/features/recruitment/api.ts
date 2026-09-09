import { apiClient } from "@/lib/api-client"
import type { PaginatedResponse } from "@/types/api"
import type {
  CandidateDetail,
  CandidateResumeDetail,
  CandidateResumeSummary,
  CandidateStatus,
  CandidateSummary,
  DuplicateStatus,
  Job,
  JobStatus,
  MatchStatus,
  CandidateJobMatch,
  RecruitmentAnalytics,
  RecruitmentDashboardStats,
  AiInsightsResponse,
  AiSearchResponse,
} from "@/types/recruitment"

export const recruitmentApi = {
  dashboard: {
    stats: () => apiClient.get<RecruitmentDashboardStats>("/recruitment/dashboard/stats"),
    analytics: () => apiClient.get<RecruitmentAnalytics>("/recruitment/dashboard/analytics"),
    insights: () => apiClient.get<AiInsightsResponse>("/recruitment/dashboard/insights"),
  },

  candidates: {
    list: (params?: {
      city?: string
      state?: string
      country?: string
      qualification?: string
      degree?: string
      minExperience?: number
      skill?: string
      jobTitle?: string
      previousCompany?: string
      certification?: string
      language?: string
      processingStatus?: string
      duplicateStatus?: DuplicateStatus | ""
      status?: CandidateStatus | ""
      search?: string
      page?: number
    }) => {
      const q = new URLSearchParams()
      if (params?.city) q.set("city", params.city)
      if (params?.state) q.set("state", params.state)
      if (params?.country) q.set("country", params.country)
      if (params?.qualification) q.set("qualification", params.qualification)
      if (params?.degree) q.set("degree", params.degree)
      if (params?.minExperience !== undefined && params.minExperience !== null) {
        q.set("minExperience", String(params.minExperience))
      }
      if (params?.skill) q.set("skill", params.skill)
      if (params?.jobTitle) q.set("jobTitle", params.jobTitle)
      if (params?.previousCompany) q.set("previousCompany", params.previousCompany)
      if (params?.certification) q.set("certification", params.certification)
      if (params?.language) q.set("language", params.language)
      if (params?.processingStatus) q.set("processingStatus", params.processingStatus)
      if (params?.duplicateStatus) q.set("duplicateStatus", params.duplicateStatus)
      if (params?.status) q.set("status", params.status)
      if (params?.search) q.set("search", params.search)
      if (params?.page) q.set("page", String(params.page))

      const queryStr = q.toString()
      return apiClient.getPaginated<PaginatedResponse<CandidateSummary>>(
        `/recruitment/candidates${queryStr ? `?${queryStr}` : ""}`
      )
    },

    get: (id: string) => apiClient.get<CandidateDetail>(`/recruitment/candidates/${id}`),

    create: (data: Partial<CandidateDetail>) =>
      apiClient.post<CandidateDetail>("/recruitment/candidates", data),

    update: (id: string, data: Partial<CandidateDetail>) =>
      apiClient.patch<CandidateDetail>(`/recruitment/candidates/${id}`, data),

    delete: (id: string) => apiClient.delete<void>(`/recruitment/candidates/${id}`),

    shortlist: (id: string) =>
      apiClient.patch<CandidateDetail>(`/recruitment/candidates/${id}/shortlist`),

    reject: (id: string) =>
      apiClient.patch<CandidateDetail>(`/recruitment/candidates/${id}/reject`),

    setStatus: (id: string, status: CandidateStatus) =>
      apiClient.patch<CandidateDetail>(`/recruitment/candidates/${id}/status`, { status }),

    confirmDuplicate: (id: string) =>
      apiClient.patch<CandidateDetail>(`/recruitment/candidates/${id}/confirm_duplicate`),

    dismissDuplicate: (id: string) =>
      apiClient.patch<CandidateDetail>(`/recruitment/candidates/${id}/dismiss_duplicate`),
  },

  resumes: {
    list: (params?: { status?: string; search?: string; page?: number }) => {
      const q = new URLSearchParams()
      if (params?.status) q.set("status", params.status)
      if (params?.search) q.set("search", params.search)
      if (params?.page) q.set("page", String(params.page))

      const queryStr = q.toString()
      return apiClient.getPaginated<PaginatedResponse<CandidateResumeSummary>>(
        `/recruitment/resumes${queryStr ? `?${queryStr}` : ""}`
      )
    },

    get: (id: string) => apiClient.get<CandidateResumeDetail>(`/recruitment/resumes/${id}`),

    upload: (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      return apiClient.postForm<CandidateResumeDetail>("/recruitment/resumes", formData)
    },

    reprocess: (id: string) =>
      apiClient.post<CandidateResumeDetail>(`/recruitment/resumes/${id}/reprocess`),

    downloadUrl: (id: string) => {
      const apiBase = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/v1`
      return `${apiBase}/recruitment/resumes/${id}/download`
    },

    importFromZoho: (params: {
      connectionId: string
      messageId: string
      attachmentId: string
      fileName: string
      contentType?: string
    }) => apiClient.post<CandidateResumeDetail>("/recruitment/resumes/import_from_zoho", params),

    scanZohoMail: (connectionId: string) =>
      apiClient.post<{ scannedMessages: number; detectedResumes: number }>(
        "/recruitment/resumes/scan_zoho_mail",
        { connectionId }
      ),

    delete: (id: string) => apiClient.delete<void>(`/recruitment/resumes/${id}`),
  },

  jobs: {
    list: (params?: { status?: JobStatus; search?: string }) => {
      const q = new URLSearchParams()
      if (params?.status) q.set("status", params.status)
      if (params?.search) q.set("search", params.search)
      const queryStr = q.toString()
      return apiClient.get<Job[]>(`/recruitment/jobs${queryStr ? `?${queryStr}` : ""}`)
    },

    get: (id: string) => apiClient.get<Job>(`/recruitment/jobs/${id}`),

    create: (data: {
      title: string
      departmentId?: string | null
      minExperience?: number
      requiredSkills?: string[]
      requiredQualifications?: string[]
      description?: string
      status?: JobStatus
    }) => apiClient.post<Job>("/recruitment/jobs", data),

    update: (id: string, data: Partial<Job>) =>
      apiClient.patch<Job>(`/recruitment/jobs/${id}`, data),

    delete: (id: string) => apiClient.delete<void>(`/recruitment/jobs/${id}`),

    matchCandidates: (id: string, candidateIds?: string[]) =>
      apiClient.post<Job>(`/recruitment/jobs/${id}/match_candidates`, { candidateIds }),

    updateMatch: (jobId: string, matchId: string, status: MatchStatus) =>
      apiClient.patch<CandidateJobMatch>(`/recruitment/jobs/${jobId}/matches/${matchId}`, { status }),
  },

  search: {
    ai: (query: string) => apiClient.post<AiSearchResponse>("/recruitment/search/ai", { query }),
  },
}

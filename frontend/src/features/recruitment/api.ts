import { apiClient, API_BASE } from "@/lib/api-client"
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
  FeedbackForm,
  InterviewFeedbackInput,
  InterviewListParams,
  InterviewQuestionSet,
  InterviewListResponse,
  InterviewStats,
  MyInterview,
  MailScanRun,
  ResumeFilterOptions,
  ResumeListParams,
  CandidateEmailTimeline,
  CandidateEmailMessage,
} from "@/types/recruitment"

// The interviewer's feedback form. Public and token-addressed — kept apart
// from recruitmentApi because nothing here is an authenticated admin call.
export const feedbackApi = {
  get: (token: string) => apiClient.get<FeedbackForm>(`/feedback/${encodeURIComponent(token)}`),

  submit: (token: string, values: InterviewFeedbackInput) =>
    apiClient.post<FeedbackForm>(`/feedback/${encodeURIComponent(token)}`, values),
}

// The signed-in user's own interviews. Needs no recruitment permission — the
// backend scopes every call to interviews they were assigned.
export const myInterviewsApi = {
  list: () => apiClient.get<MyInterview[]>("/my_interviews"),

  submitFeedback: (id: string, values: InterviewFeedbackInput) =>
    apiClient.post<MyInterview>(`/my_interviews/${id}/feedback`, values),

  resumeUrl: (id: string) => `${API_BASE}/my_interviews/${id}/resume`,
}

export const recruitmentApi = {
  dashboard: {
    stats: () => apiClient.get<RecruitmentDashboardStats>("/recruitment/dashboard/stats"),
    analytics: () => apiClient.get<RecruitmentAnalytics>("/recruitment/dashboard/analytics"),
    insights: () => apiClient.get<AiInsightsResponse>("/recruitment/dashboard/insights"),
  },

  interviews: {
    list: (params?: InterviewListParams) => {
      const q = new URLSearchParams()
      for (const [key, value] of Object.entries(params ?? {})) {
        if (value !== undefined && value !== null && value !== "") q.set(key, String(value))
      }

      const queryStr = q.toString()
      return apiClient.getPaginated<InterviewListResponse>(
        `/recruitment/interviews${queryStr ? `?${queryStr}` : ""}`
      )
    },

    stats: () => apiClient.get<InterviewStats>("/recruitment/interviews/stats"),
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
      status?: CandidateStatus | CandidateStatus[] | ""
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
      // An array goes over as status[]=a&status[]=b, which Rails parses back
      // into an array — the interview list filters on all four stages at once.
      if (Array.isArray(params?.status)) params.status.forEach((st) => q.append("status[]", st))
      else if (params?.status) q.set("status", params.status)
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

    // Assigns the interviewer and sends the candidate a single-use Calendly
    // booking link. No date or time: the candidate picks the slot, and only
    // Calendly confirming it moves them to Interview Scheduled.
    scheduleInterview: (id: string, values: { interviewerId: string }) =>
      apiClient.patch<CandidateDetail>(`/recruitment/candidates/${id}/schedule_interview`, values),

    // Free and instant: returns whatever was generated last, and never calls
    // the AI. Opening the panel must not cost anything.
    interviewQuestions: (id: string) =>
      apiClient.get<InterviewQuestionSet>(`/recruitment/candidates/${id}/interview_questions`),

    // Spends an AI call and replaces the stored set.
    generateInterviewQuestions: (id: string, jobId?: string) =>
      apiClient.post<InterviewQuestionSet>(
        `/recruitment/candidates/${id}/interview_questions`,
        jobId ? { jobId } : {}
      ),

    // Sends now (once the interview is over); InterviewFeedbackRequestsJob
    // otherwise sends it an hour after the interview.
    requestFeedback: (id: string) =>
      apiClient.patch<CandidateDetail>(`/recruitment/candidates/${id}/request_feedback`),

    // Status only — no email goes to the candidate.
    offer: (id: string) =>
      apiClient.patch<CandidateDetail>(`/recruitment/candidates/${id}/offer`),

    confirmDuplicate: (id: string) =>
      apiClient.patch<CandidateDetail>(`/recruitment/candidates/${id}/confirm_duplicate`),

    dismissDuplicate: (id: string) =>
      apiClient.patch<CandidateDetail>(`/recruitment/candidates/${id}/dismiss_duplicate`),
  },

  resumes: {
    list: (params?: ResumeListParams) => {
      const q = new URLSearchParams()
      // Every param is a plain string or number with the same name on the
      // server, so they are copied across as-is; blanks are left off.
      for (const [key, value] of Object.entries(params ?? {})) {
        if (value !== undefined && value !== null && value !== "") q.set(key, String(value))
      }

      const queryStr = q.toString()
      return apiClient.getPaginated<PaginatedResponse<CandidateResumeSummary>>(
        `/recruitment/resumes${queryStr ? `?${queryStr}` : ""}`
      )
    },

    filterOptions: () => apiClient.get<ResumeFilterOptions>("/recruitment/resumes/filter_options"),

    get: (id: string) => apiClient.get<CandidateResumeDetail>(`/recruitment/resumes/${id}`),

    upload: (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      return apiClient.postForm<CandidateResumeDetail>("/recruitment/resumes", formData)
    },

    reprocess: (id: string) =>
      apiClient.post<CandidateResumeDetail>(`/recruitment/resumes/${id}/reprocess`),

    // Saves the file — Content-Disposition: attachment on the backend.
    downloadUrl: (id: string) => {
      return `${API_BASE}/recruitment/resumes/${id}/download`
    },

    // Renders the file in the browser — the same bytes as downloadUrl, but
    // served inline and with the Content-Type corrected from the filename.
    // Pointing a preview at downloadUrl is what made Preview save the PDF
    // instead of showing it; see ResumesController#preview for why the
    // stored content type can't be trusted for this.
    previewUrl: (id: string) => {
      return `${API_BASE}/recruitment/resumes/${id}/preview`
    },

    importFromZoho: (params: {
      connectionId: string
      messageId: string
      attachmentId: string
      fileName: string
      contentType?: string
    }) => apiClient.post<CandidateResumeDetail>("/recruitment/resumes/import_from_zoho", params),

    // Starts one background scan per chosen mailbox (they run in parallel)
    // and answers straight away; progress comes from scanZohoMailStatus.
    scanZohoMail: (connectionIds: string[], range: { from: string; to: string }) =>
      apiClient.post<MailScanRun>("/recruitment/resumes/scan_zoho_mail", {
        connectionIds,
        from: range.from,
        to: range.to,
      }),

    scanZohoMailStatus: (scanId: string) =>
      apiClient.get<MailScanRun>(`/recruitment/resumes/scan_zoho_mail/${encodeURIComponent(scanId)}`),

    delete: (id: string) => apiClient.delete<void>(`/recruitment/resumes/${id}`),

    // The candidate's email timeline: their conversation in the connected
    // Zoho mailboxes plus the recruitment mail the app sent them.
    emails: (id: string) => apiClient.get<CandidateEmailTimeline>(`/recruitment/resumes/${id}/emails`),

    // One Zoho message from that timeline, in full.
    email: (id: string, messageId: string, connectionId: string) =>
      apiClient.get<CandidateEmailMessage>(
        `/recruitment/resumes/${id}/emails/${encodeURIComponent(messageId)}?connectionId=${encodeURIComponent(connectionId)}`
      ),
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

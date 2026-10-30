"use client"

import { useEffect, useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { myInterviewsApi, recruitmentApi } from "./api"
import type {
  CandidateDetail,
  InterviewFeedbackInput,
  InterviewListParams,
  CandidateStatus,
  DuplicateStatus,
  Job,
  JobStatus,
  MatchStatus,
  ResumeListParams,
} from "@/types/recruitment"

export function useRecruitmentStats() {
  return useQuery({
    queryKey: ["recruitment", "dashboard", "stats"],
    queryFn: recruitmentApi.dashboard.stats,
    refetchInterval: 30000,
  })
}

export function useRecruitmentAnalytics() {
  return useQuery({
    queryKey: ["recruitment", "dashboard", "analytics"],
    queryFn: recruitmentApi.dashboard.analytics,
  })
}

export function useRecruitmentInsights() {
  return useQuery({
    queryKey: ["recruitment", "dashboard", "insights"],
    queryFn: recruitmentApi.dashboard.insights,
    staleTime: 5 * 60 * 1000,
  })
}

export function useInterviews(params: InterviewListParams, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["recruitment", "interviews", params],
    queryFn: () => recruitmentApi.interviews.list(params),
    placeholderData: (previousData) => previousData,
    enabled,
  })
}

export function useInterviewStats() {
  return useQuery({
    queryKey: ["recruitment", "interviews", "stats"],
    queryFn: recruitmentApi.interviews.stats,
  })
}

export function useMyInterviews() {
  return useQuery({
    queryKey: ["my-interviews"],
    queryFn: myInterviewsApi.list,
  })
}

export function useSubmitMyInterviewFeedback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: InterviewFeedbackInput }) =>
      myInterviewsApi.submitFeedback(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-interviews"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "interviews"] })
    },
  })
}

export function useCandidates(params?: {
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
  enabled?: boolean
}) {
  const { enabled, ...queryParams } = params ?? {}
  return useQuery({
    queryKey: ["recruitment", "candidates", queryParams],
    queryFn: () => recruitmentApi.candidates.list(queryParams),
    placeholderData: (previousData) => previousData,
    refetchInterval: 10000, // auto poll — candidates are created/updated by async resume-processing jobs
    enabled: enabled ?? true,
  })
}

export function useCandidate(id: string) {
  return useQuery({
    queryKey: ["recruitment", "candidates", id],
    queryFn: () => recruitmentApi.candidates.get(id),
    enabled: !!id,
  })
}

export function useCandidateMutations() {
  const queryClient = useQueryClient()

  const shortlistMutation = useMutation({
    mutationFn: (id: string) => recruitmentApi.candidates.shortlist(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "candidates"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "dashboard"] })
      // Resumes embed candidateStatus/candidate.status — the Resume detail
      // panel's Shortlist/Reject buttons read straight from this cache, so
      // without this it'd keep showing the pre-shortlist state until some
      // unrelated refetch happened to run.
      queryClient.invalidateQueries({ queryKey: ["recruitment", "resumes"] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => recruitmentApi.candidates.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "candidates"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "resumes"] })
    },
  })

  const setStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CandidateStatus }) =>
      recruitmentApi.candidates.setStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "candidates"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "dashboard"] })
      // The resume panel reads the candidate's status off the resume detail
      // query, so a status change has to invalidate resumes too or the badge
      // and the available actions stay stale until a manual refresh.
      queryClient.invalidateQueries({ queryKey: ["recruitment", "resumes"] })
    },
  })

  const scheduleInterviewMutation = useMutation({
    mutationFn: ({ id, ...values }: { id: string; interviewerId: string }) =>
      recruitmentApi.candidates.scheduleInterview(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "candidates"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "resumes"] })
    },
  })

  const requestFeedbackMutation = useMutation({
    mutationFn: (id: string) => recruitmentApi.candidates.requestFeedback(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "interviews"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "candidates"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "resumes"] })
    },
  })

  const offerMutation = useMutation({
    mutationFn: (id: string) => recruitmentApi.candidates.offer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "interviews"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "candidates"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "resumes"] })
    },
  })

  // Lets an admin fill in or correct the profile the AI produced — the only
  // way to supply something extraction couldn't recover (a resume whose PDF
  // mangles its own contact line, say). Invalidates resumes too, since the
  // resume panel reads the candidate through its own query.
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<CandidateDetail>) =>
      recruitmentApi.candidates.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "candidates"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "resumes"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "dashboard"] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => recruitmentApi.candidates.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "candidates"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "dashboard"] })
    },
  })

  const confirmDuplicateMutation = useMutation({
    mutationFn: (id: string) => recruitmentApi.candidates.confirmDuplicate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "candidates"] })
    },
  })

  const dismissDuplicateMutation = useMutation({
    mutationFn: (id: string) => recruitmentApi.candidates.dismissDuplicate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "candidates"] })
    },
  })

  return {
    shortlist: shortlistMutation,
    reject: rejectMutation,
    setStatus: setStatusMutation,
    updateCandidate: updateMutation,
    scheduleInterview: scheduleInterviewMutation,
    requestFeedback: requestFeedbackMutation,
    offer: offerMutation,
    deleteCandidate: deleteMutation,
    confirmDuplicate: confirmDuplicateMutation,
    dismissDuplicate: dismissDuplicateMutation,
  }
}

export function useResumes(params?: ResumeListParams & { enabled?: boolean }) {
  const { enabled, ...queryParams } = params ?? {}
  return useQuery({
    queryKey: ["recruitment", "resumes", queryParams],
    queryFn: () => recruitmentApi.resumes.list(queryParams),
    // Only poll while something is actually being processed, which is what
    // the interval was always for. It used to run every 10s forever, so an
    // idle tab kept consuming one of the server's few request threads on a
    // fixed cadence and competed with real user actions.
    refetchInterval: (query) =>
      query.state.data?.data?.some((r) => r.processingStatus === "pending" || r.processingStatus === "processing")
        ? 10000
        : false,
    enabled: enabled ?? true,
  })
}

/**
 * Choices for the Resumes filter panel (cities, roles, graduation years). They
 * only change as resumes are imported, so a few minutes' staleness is fine.
 */
export function useResumeFilterOptions() {
  return useQuery({
    queryKey: ["recruitment", "resumes", "filter-options"],
    queryFn: recruitmentApi.resumes.filterOptions,
    staleTime: 5 * 60 * 1000,
  })
}

export function useResume(id: string) {
  return useQuery({
    queryKey: ["recruitment", "resumes", id],
    queryFn: () => recruitmentApi.resumes.get(id),
    enabled: !!id,
  })
}

// The resume panel's Emails tab — used only by the tab itself, so it is fetched
// only while the tab is open: it searches every connected mailbox live
// (cached ~60s on the backend).
export function useResumeEmails(id: string) {
  return useQuery({
    queryKey: ["recruitment", "resumes", id, "emails"],
    queryFn: () => recruitmentApi.resumes.emails(id),
    enabled: !!id,
  })
}

// One Zoho message from that timeline, loaded when its entry is expanded. A
// message never changes, so it is never refetched.
export function useResumeEmailMessage(id: string, messageId: string, connectionId: string | undefined) {
  return useQuery({
    queryKey: ["recruitment", "resumes", id, "emails", connectionId, messageId],
    queryFn: () => recruitmentApi.resumes.email(id, messageId, connectionId!),
    enabled: !!id && !!messageId && !!connectionId,
    staleTime: Infinity,
  })
}

export function useResumeMutations() {
  const queryClient = useQueryClient()

  const uploadMutation = useMutation({
    mutationFn: (file: File) => recruitmentApi.resumes.upload(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "resumes"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "candidates"] })
    },
  })

  const reprocessMutation = useMutation({
    mutationFn: (id: string) => recruitmentApi.resumes.reprocess(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "resumes"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "candidates"] })
    },
  })

  const importFromZohoMutation = useMutation({
    mutationFn: recruitmentApi.resumes.importFromZoho,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "resumes"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "candidates"] })
    },
  })

  // Only STARTS the scans — the resume lists are refreshed by
  // useMailScanRun as each mailbox finishes, not here.
  const scanZohoMailMutation = useMutation({
    mutationFn: ({ connectionIds, from, to }: { connectionIds: string[]; from: string; to: string }) =>
      recruitmentApi.resumes.scanZohoMail(connectionIds, { from, to }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => recruitmentApi.resumes.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "resumes"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "candidates"] })
    },
  })

  return {
    upload: uploadMutation,
    reprocess: reprocessMutation,
    importFromZoho: importFromZohoMutation,
    scanZohoMail: scanZohoMailMutation,
    deleteResume: deleteMutation,
  }
}

/** Polls a manual Scan Mail run until every mailbox in it has finished,
 *  refreshing the resume lists whenever another mailbox completes so new
 *  imports show up without waiting for the slowest mailbox. */
export function useMailScanRun(scanId: string | null) {
  const queryClient = useQueryClient()
  const completedRef = useRef(0)

  const query = useQuery({
    queryKey: ["recruitment", "mail-scan", scanId],
    queryFn: () => recruitmentApi.resumes.scanZohoMailStatus(scanId as string),
    enabled: !!scanId,
    refetchInterval: (q) => (q.state.data?.finished ? false : 2000),
  })

  const completed = query.data?.accounts.filter((a) => a.status === "completed").length ?? 0
  useEffect(() => {
    if (completed > completedRef.current) {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "resumes"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "candidates"] })
    }
    completedRef.current = completed
  }, [completed, queryClient])

  return query
}

export function useJobs(params?: { status?: JobStatus; search?: string }) {
  return useQuery({
    queryKey: ["recruitment", "jobs", params],
    queryFn: () => recruitmentApi.jobs.list(params),
  })
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ["recruitment", "jobs", id],
    queryFn: () => recruitmentApi.jobs.get(id),
    enabled: !!id,
  })
}

export function useJobMutations() {
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: recruitmentApi.jobs.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "jobs"] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Job> }) =>
      recruitmentApi.jobs.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "jobs"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "jobs", variables.id] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => recruitmentApi.jobs.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "jobs"] })
    },
  })

  const matchCandidatesMutation = useMutation({
    mutationFn: ({ id, candidateIds }: { id: string; candidateIds?: string[] }) =>
      recruitmentApi.jobs.matchCandidates(id, candidateIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "jobs", variables.id] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "candidates"] })
    },
  })

  const updateMatchMutation = useMutation({
    mutationFn: ({
      jobId,
      matchId,
      status,
    }: {
      jobId: string
      matchId: string
      status: MatchStatus
    }) => recruitmentApi.jobs.updateMatch(jobId, matchId, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "jobs", variables.jobId] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "candidates"] })
    },
  })

  return {
    createJob: createMutation,
    updateJob: updateMutation,
    deleteJob: deleteMutation,
    matchCandidates: matchCandidatesMutation,
    updateMatch: updateMatchMutation,
  }
}

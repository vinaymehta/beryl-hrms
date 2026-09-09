"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { recruitmentApi } from "./api"
import type { CandidateStatus, DuplicateStatus, JobStatus, MatchStatus } from "@/types/recruitment"

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
  status?: CandidateStatus | ""
  search?: string
  page?: number
}) {
  return useQuery({
    queryKey: ["recruitment", "candidates", params],
    queryFn: () => recruitmentApi.candidates.list(params),
    placeholderData: (previousData) => previousData,
    refetchInterval: 10000, // auto poll — candidates are created/updated by async resume-processing jobs
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
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => recruitmentApi.candidates.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "candidates"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "dashboard"] })
    },
  })

  const setStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CandidateStatus }) =>
      recruitmentApi.candidates.setStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "candidates"] })
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
    deleteCandidate: deleteMutation,
    confirmDuplicate: confirmDuplicateMutation,
    dismissDuplicate: dismissDuplicateMutation,
  }
}

export function useResumes(params?: { status?: string; search?: string; page?: number }) {
  return useQuery({
    queryKey: ["recruitment", "resumes", params],
    queryFn: () => recruitmentApi.resumes.list(params),
    refetchInterval: 10000, // auto poll while processing
  })
}

export function useResume(id: string) {
  return useQuery({
    queryKey: ["recruitment", "resumes", id],
    queryFn: () => recruitmentApi.resumes.get(id),
    enabled: !!id,
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

  const scanZohoMailMutation = useMutation({
    mutationFn: (connectionId: string) => recruitmentApi.resumes.scanZohoMail(connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment", "resumes"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["recruitment", "candidates"] })
    },
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
    mutationFn: ({ id, data }: { id: string; data: any }) =>
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

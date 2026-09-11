export type CandidateStatus =
  | "applied"
  | "screening"
  | "interviewing"
  | "shortlisted"
  | "offered"
  | "rejected"
  | "needs_review"

export type DuplicateStatus = "unique_record" | "potential_duplicate" | "confirmed_duplicate"

export type ProcessingStatus = "pending" | "processing" | "completed" | "failed" | "not_a_resume" | "duplicate"

export type JobStatus = "draft" | "open" | "closed"

export type MatchStatus = "suggested" | "shortlisted" | "rejected"

export interface CandidateSkill {
  id: string
  name: string
  category: string | null
  confidence: number
  provenance: string
}

export interface CandidateQualification {
  id: string
  degree: string
  fieldOfStudy: string | null
  institution: string | null
  yearCompleted: number | null
  confidence: number
  provenance: string
}

export interface CandidateExperience {
  id: string
  jobTitle: string
  companyName: string
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
  durationMonths: number | null
  description: string | null
  confidence: number
  provenance: string
}

export interface CandidateCertification {
  id: string
  name: string
  issuingOrganization: string | null
  issueDate: string | null
  confidence: number
  provenance: string
}

export interface CandidateResumeSummary {
  id: string
  fileName: string
  fileSize: number
  contentType: string
  processingStatus: ProcessingStatus
  source: string
  sourceEmailId: string | null
  sourceAttachmentId: string | null
  createdAt: string
  processedAt: string | null
  errorMessage: string | null
  candidateId: string | null
  candidateName?: string | null
  candidateEmail?: string | null
  candidateStatus?: string | null
  candidateCity?: string | null
  candidateQualification?: string | null
  candidateExperienceYears?: number | null
  hasFile: boolean
  isCurrent: boolean
  duplicateOfId: string | null
  isDuplicate: boolean
  atsScore: number | null
  criteriaMatchPercentage: number | null
  aiMetadata?: {
    provider?: string
    model?: string
    prompt_version?: string
    evaluated_at?: string
    processed_at?: string
  }
}

export interface CandidateResumeDetail extends CandidateResumeSummary {
  rawText: string | null
  extractedData: any
  provenanceData: any
  aiMetadata?: {
    provider?: string
    model?: string
    prompt_version?: string
    evaluated_at?: string
    processed_at?: string
  }
  fileHash: string | null
  eligibilityBreakdown: {
    qualification: boolean | null
    marks: boolean | null
    graduation_year: boolean | null
    backlog: boolean | null
  } | null
  candidate?: {
    id: string
    fullName: string
    email: string | null
    phone: string | null
    city: string | null
    currentRole: string | null
    status: CandidateStatus
  } | null
}

export interface CandidateSummary {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  city: string | null
  currentRole: string | null
  highestQualification: string | null
  experienceYears: number
  status: CandidateStatus
  source: string
  duplicateStatus: DuplicateStatus
  createdAt: string
  skills: string[]
  hasResume: boolean
  latestResumeId: string | null
  // Tri-state (null = unconfirmed, never coerced to a pass/fail) —
  // see Recruitment::EligibilityEvaluator on the backend.
  academicPercentage: number | null
  academicCgpa: number | null
  graduationYear: number | null
  activeBacklogs: boolean | null
  criteriaMatchPercentage: number | null
  atsScore: number | null
  resumeDate: string | null
}

export interface CandidateDetail extends CandidateSummary {
  firstName?: string | null
  lastName?: string | null
  state?: string | null
  country?: string | null
  currentLocation?: string | null
  preferredLocation?: string | null
  noticePeriod?: string | null
  industry?: string | null
  languages?: string[]
  notes?: string | null
  skills: any[] // CandidateSkill[]
  qualifications: CandidateQualification[]
  experiences: CandidateExperience[]
  certifications: CandidateCertification[]
  resumes: CandidateResumeSummary[]
}

export interface CandidateJobMatch {
  id: string
  candidateId: string
  candidateName: string
  candidateEmail: string | null
  candidateRole: string | null
  candidateCity: string | null
  candidateExperience: number
  candidateStatus: string
  matchScore: number
  skillsScore: number
  experienceScore: number
  qualificationScore: number
  strongMatches: string[]
  potentialGaps: string[]
  matchingSkills: string[]
  missingSkills: string[]
  aiExplanation: string
  aiMetadata?: any
  status: MatchStatus
  updatedAt: string
}

export interface Job {
  id: string
  title: string
  departmentId: string | null
  departmentName?: string | null
  minExperience: number
  requiredSkills: string[]
  requiredQualifications: string[]
  status: JobStatus
  description: string | null
  createdAt: string
  totalMatchesCount: number
  shortlistedCount: number
  matches?: CandidateJobMatch[]
}

export interface RecruitmentDashboardStats {
  totalCandidates: number
  newResumes: number
  processedResumes: number
  processingFailures: number
  shortlistedCandidates: number
  needsReviewCandidates: number
  hiredThisMonth: number
  totalResumes: number
  needsReviewResumes: number
  shortlistedResumes: number
  rejectedResumes: number
  otherResumes: number
}

export interface RecruitmentAnalytics {
  candidatesByCity: { name: string; count: number }[]
  candidatesByQualification: { name: string; count: number }[]
  candidatesByJobTitle: { name: string; count: number }[]
  experienceDistribution: { bracket: string; count: number }[]
  topSkills: { name: string; count: number }[]
  candidatePipeline: { status: string; count: number }[]
  resumeProcessingStatus: { status: string; count: number }[]
  matchScoreDistribution: { bracket: string; count: number }[]
}

export interface AiInsightCard {
  title: string
  detail: string
  action: string
}

export interface AiInsightsResponse {
  summary: string
  insights: AiInsightCard[]
  generated_at?: string
}

export interface AiSearchResponse {
  interpretation: string
  criteria: {
    city?: string | null
    state?: string | null
    country?: string | null
    skills?: string[]
    minExperience?: number | null
    qualifications?: string[]
    jobTitle?: string | null
  }
  candidates: CandidateSummary[]
}

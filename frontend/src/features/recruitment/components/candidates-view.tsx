"use client"

import { useState } from "react"
import { useCandidates, useCandidateMutations } from "../hooks"
import { CandidateDetailModal } from "./candidate-detail-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  SearchIcon,
  FilterIcon,
  StarIcon,
  XCircleIcon,
  EyeIcon,
  FileTextIcon,
  MapPinIcon,
  BriefcaseIcon,
  AlertTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SparklesIcon,
} from "lucide-react"
import type { CandidateStatus, CandidateSummary } from "@/types/recruitment"
import { recruitmentApi } from "../api"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@/constants/permissions"

interface CandidatesViewProps {
  initialStatus?: CandidateStatus | ""
}

export function CandidatesView({ initialStatus = "" }: CandidatesViewProps) {
  const [search, setSearch] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [country, setCountry] = useState("")
  const [qualification, setQualification] = useState("")
  const [skill, setSkill] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [previousCompany, setPreviousCompany] = useState("")
  const [certification, setCertification] = useState("")
  const [language, setLanguage] = useState("")
  const [minExperience, setMinExperience] = useState("")
  const [processingStatus, setProcessingStatus] = useState("")
  const [status, setStatus] = useState<CandidateStatus | "">(initialStatus)
  const [page, setPage] = useState(1)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const canManage = usePermission([PERMISSIONS.recruitmentManage, PERMISSIONS.candidatesManage])

  const { data: response, isLoading } = useCandidates({
    search: search.trim() || undefined,
    city: city.trim() || undefined,
    state: state.trim() || undefined,
    country: country.trim() || undefined,
    qualification: qualification.trim() || undefined,
    skill: skill.trim() || undefined,
    jobTitle: jobTitle.trim() || undefined,
    previousCompany: previousCompany.trim() || undefined,
    certification: certification.trim() || undefined,
    language: language.trim() || undefined,
    minExperience: minExperience.trim() ? Number(minExperience) : undefined,
    processingStatus: processingStatus || undefined,
    status: status || undefined,
    page,
  })

  const { shortlist, reject } = useCandidateMutations()

  const candidates = response?.data ?? []
  const meta = response?.meta

  const handleShortlist = async (c: CandidateSummary, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await shortlist.mutateAsync(c.id)
      toast.success(`${c.fullName} marked as Shortlisted`)
    } catch (err: any) {
      toast.error(err?.message || "Failed to shortlist")
    }
  }

  const handleReject = async (c: CandidateSummary, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await reject.mutateAsync(c.id)
      toast.info(`${c.fullName} marked as Rejected`)
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status")
    }
  }

  const statusPills: { label: string; value: CandidateStatus | "" }[] = [
    { label: "All Candidates", value: "" },
    { label: "Needs Review", value: "needs_review" },
    { label: "Shortlisted", value: "shortlisted" },
    { label: "Screening", value: "screening" },
    { label: "Interviewing", value: "interviewing" },
    { label: "Offered", value: "offered" },
    { label: "Rejected", value: "rejected" },
  ]

  const statusColors: Record<string, string> = {
    needs_review: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    shortlisted: "bg-role-recruitment/10 text-role-recruitment border-role-recruitment/30",
    applied: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    screening: "bg-purple-500/10 text-purple-600 border-purple-500/30",
    interviewing: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30",
    offered: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    rejected: "bg-muted text-muted-foreground border-border",
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter Header */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search by name, role, email, city..."
              className="pl-8 text-xs h-9"
            />
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={`text-xs gap-1.5 h-9 shrink-0 ${showFilters ? "border-primary text-primary" : ""}`}
          >
            <FilterIcon className="size-3.5" />
            {showFilters ? "Hide Filters" : "Deterministic Filters"}
          </Button>
        </div>

        {/* Collapsible Deterministic Filter Row */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3 rounded-lg border bg-muted/20 text-xs animate-fadeIn">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">City</label>
              <Input
                value={city}
                onChange={(e) => {
                  setCity(e.target.value)
                  setPage(1)
                }}
                placeholder="e.g. Bangalore, Mumbai"
                className="h-8 text-xs mt-1"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">State</label>
              <Input
                value={state}
                onChange={(e) => {
                  setState(e.target.value)
                  setPage(1)
                }}
                placeholder="e.g. Karnataka"
                className="h-8 text-xs mt-1"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Country</label>
              <Input
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value)
                  setPage(1)
                }}
                placeholder="e.g. India"
                className="h-8 text-xs mt-1"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Skill</label>
              <Input
                value={skill}
                onChange={(e) => {
                  setSkill(e.target.value)
                  setPage(1)
                }}
                placeholder="e.g. React, Python, Ruby"
                className="h-8 text-xs mt-1"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Qualification</label>
              <Input
                value={qualification}
                onChange={(e) => {
                  setQualification(e.target.value)
                  setPage(1)
                }}
                placeholder="e.g. B.Tech, MBA, MCA"
                className="h-8 text-xs mt-1"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Min. Experience (yrs)</label>
              <Input
                type="number"
                min="0"
                value={minExperience}
                onChange={(e) => {
                  setMinExperience(e.target.value)
                  setPage(1)
                }}
                placeholder="e.g. 3"
                className="h-8 text-xs mt-1"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Job Title</label>
              <Input
                value={jobTitle}
                onChange={(e) => {
                  setJobTitle(e.target.value)
                  setPage(1)
                }}
                placeholder="e.g. Backend Engineer"
                className="h-8 text-xs mt-1"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Previous Company</label>
              <Input
                value={previousCompany}
                onChange={(e) => {
                  setPreviousCompany(e.target.value)
                  setPage(1)
                }}
                placeholder="e.g. Infosys"
                className="h-8 text-xs mt-1"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Certification</label>
              <Input
                value={certification}
                onChange={(e) => {
                  setCertification(e.target.value)
                  setPage(1)
                }}
                placeholder="e.g. AWS Certified"
                className="h-8 text-xs mt-1"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Language</label>
              <Input
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value)
                  setPage(1)
                }}
                placeholder="e.g. Hindi, English"
                className="h-8 text-xs mt-1"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Processing Status</label>
              <select
                value={processingStatus}
                onChange={(e) => {
                  setProcessingStatus(e.target.value)
                  setPage(1)
                }}
                className="h-8 w-full rounded-md border bg-background text-xs mt-1 px-2"
              >
                <option value="">Any</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="not_a_resume">Not a Resume</option>
              </select>
            </div>
          </div>
        )}

        {/* Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b text-xs">
          {statusPills.map((p) => (
            <button
              key={p.value}
              onClick={() => {
                setStatus(p.value)
                setPage(1)
              }}
              className={`rounded-md px-3 py-1.5 font-medium whitespace-nowrap transition-colors ${
                status === p.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Candidate List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-xs text-muted-foreground space-y-2">
          <SparklesIcon className="size-8 text-muted-foreground/40 mx-auto" />
          <p className="font-semibold text-foreground text-sm">No candidates match this criteria</p>
          <p className="max-w-md mx-auto text-muted-foreground">
            Try adjusting your deterministic filters or search query, or import more candidate resumes from Zoho Mail.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {candidates.map((candidate) => (
            <Card
              key={candidate.id}
              onClick={() => setSelectedCandidateId(candidate.id)}
              className="cursor-pointer hover:border-role-recruitment/40 transition-colors shadow-2xs group"
            >
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground truncate">
                      {candidate.fullName}
                    </span>

                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        statusColors[candidate.status] || "bg-muted text-muted-foreground"
                      }`}
                    >
                      {candidate.status.replace("_", " ")}
                    </span>

                    {candidate.duplicateStatus === "potential_duplicate" && (
                      <span
                        title="Potential duplicate candidate or resume detected"
                        className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600"
                      >
                        <AlertTriangleIcon className="size-3" /> Duplicate Alert
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {candidate.currentRole && (
                      <span className="flex items-center gap-1 font-medium text-foreground/90">
                        <BriefcaseIcon className="size-3 text-muted-foreground" />
                        {candidate.currentRole}
                      </span>
                    )}

                    {candidate.city && (
                      <span className="flex items-center gap-1">
                        <MapPinIcon className="size-3 text-muted-foreground" />
                        {candidate.city}
                      </span>
                    )}

                    <span>{candidate.experienceYears} Years Exp</span>

                    {candidate.highestQualification && (
                      <span className="text-muted-foreground/80">
                        • {candidate.highestQualification}
                      </span>
                    )}
                  </div>

                  {/* Skills preview */}
                  {candidate.skills && candidate.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {candidate.skills.slice(0, 5).map((sk, idx) => (
                        <span
                          key={idx}
                          className="rounded-md bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-foreground/80"
                        >
                          {sk}
                        </span>
                      ))}
                      {candidate.skills.length > 5 && (
                        <span className="text-[10px] text-muted-foreground font-medium self-center">
                          +{candidate.skills.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  {candidate.latestResumeId && (
                    <a
                      href={recruitmentApi.resumes.downloadUrl(candidate.latestResumeId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-role-recruitment transition-colors shadow-2xs"
                      title="Open attached resume"
                    >
                      <FileTextIcon className="size-3.5" />
                      Resume
                    </a>
                  )}

                  {canManage && candidate.status !== "shortlisted" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => handleShortlist(candidate, e)}
                      className="h-8 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1"
                      title="Shortlist candidate"
                    >
                      <StarIcon className="size-3.5" />
                      Shortlist
                    </Button>
                  )}

                  {canManage && candidate.status !== "rejected" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => handleReject(candidate, e)}
                      className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Reject candidate"
                    >
                      <XCircleIcon className="size-3.5" />
                      <span className="sr-only">Reject</span>
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedCandidateId(candidate.id)
                    }}
                    className="h-8 text-xs gap-1"
                  >
                    <EyeIcon className="size-3.5" />
                    Profile
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
          <span>
            Showing page {meta.page} of {meta.totalPages} ({meta.totalCount} candidates)
          </span>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="h-8 text-xs gap-1"
            >
              <ChevronLeftIcon className="size-3.5" /> Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.min(p + 1, meta.totalPages))}
              disabled={page >= meta.totalPages}
              className="h-8 text-xs gap-1"
            >
              Next <ChevronRightIcon className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      <CandidateDetailModal
        candidateId={selectedCandidateId}
        open={!!selectedCandidateId}
        onOpenChange={(open) => !open && setSelectedCandidateId(null)}
      />
    </div>
  )
}

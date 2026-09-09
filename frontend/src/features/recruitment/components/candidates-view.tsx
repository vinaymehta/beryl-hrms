"use client"

import { useState } from "react"
import { useCandidates, useCandidateMutations } from "../hooks"
import { CandidateDetailModal } from "./candidate-detail-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (`${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase()) || "?"
}

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
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [bulkPending, setBulkPending] = useState(false)

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

  function toggleChecked(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleCheckAll() {
    const ids = candidates.map((c) => c.id)
    const allChecked = ids.length > 0 && ids.every((id) => checkedIds.has(id))
    setCheckedIds(allChecked ? new Set() : new Set(ids))
  }

  async function bulkShortlist() {
    if (checkedIds.size === 0) return
    setBulkPending(true)
    try {
      await Promise.all(Array.from(checkedIds).map((id) => shortlist.mutateAsync(id)))
      toast.success(`${checkedIds.size} candidate(s) shortlisted`)
      setCheckedIds(new Set())
    } catch (err: any) {
      toast.error(err?.message || "Failed to shortlist selected candidates")
    } finally {
      setBulkPending(false)
    }
  }

  async function bulkReject() {
    if (checkedIds.size === 0) return
    setBulkPending(true)
    try {
      await Promise.all(Array.from(checkedIds).map((id) => reject.mutateAsync(id)))
      toast.info(`${checkedIds.size} candidate(s) rejected`)
      setCheckedIds(new Set())
    } catch (err: any) {
      toast.error(err?.message || "Failed to reject selected candidates")
    } finally {
      setBulkPending(false)
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

        {/* Status Tabs — each pill uses the same semantic color as its
            status badge elsewhere in the app (candidate rows, dashboard
            pipeline), so the active state reads as that status's color
            rather than a uniform violet regardless of which one is picked. */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b text-xs">
          {statusPills.map((p) => {
            const isActive = status === p.value
            const activeColor = p.value ? statusColors[p.value] : "bg-primary/10 text-primary border-primary/30"
            return (
              <button
                key={p.value}
                onClick={() => {
                  setStatus(p.value)
                  setPage(1)
                }}
                className={`rounded-md border px-3 py-1.5 font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? activeColor
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Candidate List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
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
        <div className="rounded-xl border shadow-2xs overflow-hidden">
          {canManage && checkedIds.size > 0 && (
            <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
              <span className="text-xs font-medium text-foreground">{checkedIds.size} selected</span>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" disabled={bulkPending} onClick={bulkShortlist} className="h-7 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10">
                  <StarIcon className="size-3.5" /> Shortlist
                </Button>
                <Button size="sm" variant="ghost" disabled={bulkPending} onClick={bulkReject} className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                  <XCircleIcon className="size-3.5" /> Reject
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCheckedIds(new Set())} className="h-7 text-xs text-muted-foreground">
                  Clear
                </Button>
              </div>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                {canManage && (
                  <TableHead className="w-8">
                    <input
                      type="checkbox"
                      checked={candidates.length > 0 && candidates.every((c) => checkedIds.has(c.id))}
                      onChange={toggleCheckAll}
                      className="size-4 cursor-pointer accent-primary"
                      aria-label="Select all"
                    />
                  </TableHead>
                )}
                <TableHead>Candidate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Qualification</TableHead>
                <TableHead>Skills</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((candidate) => (
                <TableRow
                  key={candidate.id}
                  onClick={() => setSelectedCandidateId(candidate.id)}
                  className="cursor-pointer"
                >
                  {canManage && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checkedIds.has(candidate.id)}
                        onChange={() => toggleChecked(candidate.id)}
                        className="size-4 cursor-pointer accent-primary"
                        aria-label={`Select ${candidate.fullName}`}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar size="sm">
                        <AvatarFallback className="bg-role-recruitment/12 text-[11px] text-role-recruitment">
                          {initials(candidate.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{candidate.fullName}</p>
                        <p className="truncate text-xs text-muted-foreground">{candidate.currentRole || "—"}</p>
                      </div>
                      {candidate.duplicateStatus === "potential_duplicate" && (
                        <span title="Potential duplicate candidate or resume detected" className="shrink-0">
                          <AlertTriangleIcon className="size-3.5 text-amber-500" />
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${
                        statusColors[candidate.status] || "bg-muted text-muted-foreground"
                      }`}
                    >
                      {candidate.status.replace("_", " ")}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {candidate.city ? (
                      <span className="flex items-center gap-1">
                        <MapPinIcon className="size-3 text-muted-foreground" /> {candidate.city}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{candidate.experienceYears} yrs</TableCell>
                  <TableCell className="text-muted-foreground">{candidate.highestQualification || "—"}</TableCell>
                  <TableCell>
                    {candidate.skills && candidate.skills.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-w-56">
                        {candidate.skills.slice(0, 3).map((sk, idx) => (
                          <span key={idx} className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-foreground/80">
                            {sk}
                          </span>
                        ))}
                        {candidate.skills.length > 3 && (
                          <span className="text-[10px] text-muted-foreground font-medium self-center">
                            +{candidate.skills.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {candidate.latestResumeId && (
                        <a
                          href={recruitmentApi.resumes.downloadUrl(candidate.latestResumeId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-role-recruitment hover:bg-muted transition-colors"
                          title="Open attached resume"
                        >
                          <FileTextIcon className="size-3.5" />
                        </a>
                      )}
                      {canManage && candidate.status !== "shortlisted" && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={(e) => handleShortlist(candidate, e)}
                          className="text-primary hover:text-primary hover:bg-primary/10"
                          title="Shortlist candidate"
                        >
                          <StarIcon className="size-3.5" />
                        </Button>
                      )}
                      {canManage && candidate.status !== "rejected" && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={(e) => handleReject(candidate, e)}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Reject candidate"
                        >
                          <XCircleIcon className="size-3.5" />
                        </Button>
                      )}
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedCandidateId(candidate.id)
                        }}
                        className="text-muted-foreground hover:text-foreground"
                        title="View profile"
                      >
                        <EyeIcon className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

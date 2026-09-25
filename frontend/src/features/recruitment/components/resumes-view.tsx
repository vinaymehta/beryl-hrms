"use client"

import { useState } from "react"
import { useResumes, useResumeMutations } from "../hooks"
import { ResumeDetailPanel } from "./resume-detail-panel"
import { DateRangeFilter } from "./date-range-filter"
import type { DateRangePreset } from "../lib/date-range-presets"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FilterPopover } from "@/components/ui/filter-popover"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  FileTextIcon,
  SearchIcon,
  RefreshCwIcon,
  DownloadIcon,
  AlertCircleIcon,
  CheckCircle2Icon,
  Loader2Icon,
  Trash2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  StarIcon,
  XCircleIcon,
  EyeIcon,
  CalendarClockIcon,
  SendIcon,
  MessageSquareTextIcon,
  type LucideIcon,
} from "lucide-react"
import { recruitmentApi } from "../api"
import { InterviewQuestionsDialog } from "./interview-questions-dialog"
import { ResumePreviewModal } from "./resume-preview-modal"
import type { CandidateResumeSummary } from "@/types/recruitment"
import { isInInterviewWorkflow } from "@/types/recruitment"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@/constants/permissions"
import { cn } from "cn"
import { errorMessage } from "@/lib/errors"

interface ResumesViewProps {
  onOpenCandidate?: (candidateId: string) => void
  initialStatus?: string
  /** Candidate eligibility status (needs_review/shortlisted/rejected/...) — distinct from the processing-status filter above. Drives the Quick Stats "Needs Review"/"Rejected Resumes" cards. */
  initialCandidateStatus?: string
}

// Mirrors each Quick Stat card's own icon/color exactly (recruitment-workspace.tsx's
// kpis array) so a filtered-by-candidate-status list reads as "you clicked that card".
const CANDIDATE_STATUS_META: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  needs_review: { label: "Needs Review", icon: AlertCircleIcon, className: "bg-amber-500/10 text-amber-600" },
  shortlisted: { label: "Shortlisted", icon: StarIcon, className: "bg-emerald-500/10 text-emerald-600" },
  rejected: { label: "Rejected", icon: XCircleIcon, className: "bg-red-500/10 text-red-600" },
}

// Same hues the candidate-status badges use everywhere else.
const INTERVIEW_BADGE: Record<string, string> = {
  interview_scheduled: "bg-cyan-500/10 text-cyan-600",
  interview_completed: "bg-teal-500/10 text-teal-600",
  feedback_received: "bg-emerald-500/10 text-emerald-600",
  feedback_not_received: "bg-orange-500/10 text-orange-600",
}

const SORT_OPTIONS = [
  { value: "", label: "Newest first" },
  { value: "date", label: "Oldest first" },
  { value: "criteria_match_desc", label: "Highest Criteria Match %" },
  { value: "criteria_match_asc", label: "Lowest Criteria Match %" },
  { value: "ats_score_desc", label: "Highest Rank" },
  { value: "ats_score_asc", label: "Lowest Rank" },
  { value: "status", label: "Status" },
]

export function ResumesView({ onOpenCandidate, initialStatus = "", initialCandidateStatus = "" }: ResumesViewProps) {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<string>(initialStatus)
  // Set once from the Quick Stats card that opened this view (see
  // recruitment-workspace.tsx) — clearing it means navigating back via the
  // Resumes tab itself, which remounts this component with a fresh filter.
  const candidateStatus = initialCandidateStatus
  const [datePreset, setDatePreset] = useState<DateRangePreset | "">("")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null)
  const [sortBy, setSortBy] = useState("")
  const [page, setPage] = useState(1)
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null)
  const [previewResume, setPreviewResume] = useState<CandidateResumeSummary | null>(null)
  // Whose interview questions are open. Null when the dialog is closed.
  const [questionsFor, setQuestionsFor] = useState<CandidateResumeSummary | null>(null)
  const [pendingDelete, setPendingDelete] = useState<CandidateResumeSummary | null>(null)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [bulkPending, setBulkPending] = useState(false)
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false)

  const canProcess = usePermission([PERMISSIONS.recruitmentManage, PERMISSIONS.resumesProcess])
  const canManage = usePermission(PERMISSIONS.recruitmentManage)

  const activeFilterCount = (dateRange ? 1 : 0) + (sortBy ? 1 : 0)

  function resetFilters() {
    setDatePreset("")
    setCustomFrom("")
    setCustomTo("")
    setDateRange(null)
    setSortBy("")
    setPage(1)
  }

  const { data: response, isLoading } = useResumes({
    search: search.trim() || undefined,
    status: status || undefined,
    candidateStatus: candidateStatus || undefined,
    dateFrom: dateRange?.from,
    dateTo: dateRange?.to,
    sortBy: sortBy || undefined,
    page,
  })

  const { reprocess, deleteResume } = useResumeMutations()

  const resumes = response?.data ?? []
  const meta = response?.meta

  const handleReprocess = async (r: CandidateResumeSummary, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await reprocess.mutateAsync(r.id)
      toast.success(`Re-queued ${r.fileName} for parsing`)
    } catch (err) {
      toast.error(errorMessage(err, "Failed to reprocess resume"))
    }
  }

  const handleDeleteClick = (r: CandidateResumeSummary, e: React.MouseEvent) => {
    e.stopPropagation()
    setPendingDelete(r)
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteResume.mutateAsync(pendingDelete.id)
      toast.info("Resume deleted")
    } catch (err) {
      toast.error(errorMessage(err, "Failed to delete resume"))
    } finally {
      setPendingDelete(null)
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
    const ids = resumes.map((r) => r.id)
    const allChecked = ids.length > 0 && ids.every((id) => checkedIds.has(id))
    setCheckedIds(allChecked ? new Set() : new Set(ids))
  }

  async function bulkReprocess() {
    if (checkedIds.size === 0) return
    setBulkPending(true)
    try {
      await Promise.all(Array.from(checkedIds).map((id) => reprocess.mutateAsync(id)))
      toast.success(`${checkedIds.size} resume(s) re-queued for parsing`)
      setCheckedIds(new Set())
    } catch (err) {
      toast.error(errorMessage(err, "Failed to reprocess selected resumes"))
    } finally {
      setBulkPending(false)
    }
  }

  async function confirmBulkDelete() {
    const ids = Array.from(checkedIds)
    setBulkPending(true)
    try {
      // Dispatched a few at a time rather than all at once with Promise.all.
      // The server runs a small, fixed number of request threads, so firing
      // N deletes concurrently just queues them there — and each one's
      // success invalidated the list, dashboard and candidates queries,
      // adding refetches that competed for the very same threads. Deleting a
      // page of resumes could stall the whole UI for tens of seconds.
      const BATCH = 4
      for (let i = 0; i < ids.length; i += BATCH) {
        await Promise.all(ids.slice(i, i + BATCH).map((id) => deleteResume.mutateAsync(id)))
      }
      toast.info(`${ids.length} resume(s) deleted`)
      setCheckedIds(new Set())
    } catch (err) {
      toast.error(errorMessage(err, "Failed to delete selected resumes"))
    } finally {
      setBulkPending(false)
      setBulkDeleteConfirmOpen(false)
    }
  }

  const statusColors: Record<string, string> = {
    pending: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    processing: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    failed: "bg-red-500/10 text-red-600 border-red-500/30",
    not_a_resume: "bg-muted text-muted-foreground border-border",
    duplicate: "bg-violet-500/10 text-violet-600 border-violet-500/30",
  }

  // "Not a Resume" isn't a pill here anymore — it now lives behind its own
  // "Other" Quick Stat card (see recruitment-workspace.tsx), so it isn't
  // duplicated as a filter option in this general-purpose row too.
  const statusPills = [
    { label: "All Resumes", value: "" },
    { label: "Needs Attention", value: "failed" },
    { label: "Duplicate", value: "duplicate" },
  ]

  return (
    <div className="space-y-4">
      {/* Filter Row — resume ingestion happens via Zoho scan (see the
          Scan Mail button above), not direct upload from this view. */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search resumes by filename or matched candidate name..."
              className="pl-8 text-xs h-9"
            />
          </div>

          <FilterPopover
            activeCount={activeFilterCount}
            onReset={resetFilters}
            ariaLabel="Filter resumes"
            accentClassName="border-role-recruitment text-role-recruitment bg-role-recruitment/5"
            badgeClassName="bg-role-recruitment text-role-recruitment-foreground"
          >
            <DateRangeFilter
              preset={datePreset}
              customFrom={customFrom}
              customTo={customTo}
              allowClear
              onChange={({ preset, customFrom: f, customTo: t, resolved }) => {
                setDatePreset(preset)
                setCustomFrom(f)
                setCustomTo(t)
                setDateRange(resolved)
                setPage(1)
              }}
            />

            <Select items={SORT_OPTIONS} value={sortBy} onValueChange={(v) => { setSortBy(v || ""); setPage(1) }}>
              <SelectTrigger aria-label="Sort resumes" className="h-8 w-40 text-xs">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterPopover>
        </div>

        {/* Status Tabs — active pill uses the same semantic color as its
            status badge on each resume row, instead of a uniform violet.
            Hidden while a candidate-status filter (Needs Review/Rejected,
            from the Quick Stats cards) is active, or when this view was
            opened via the "Other" Quick Stat card (initialStatus ===
            "not_a_resume") — both are already fixed, single-purpose views,
            not a processing-status switcher. */}
        {!candidateStatus && initialStatus !== "not_a_resume" && (
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
        )}
      </div>

      {/* Resume List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : resumes.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-xs text-muted-foreground space-y-1.5">
          <FileTextIcon className="size-8 text-muted-foreground/40 mx-auto" />
          <p className="font-semibold text-foreground text-sm">No resumes found</p>
          <p>Scan an authorized Zoho mailbox to import resumes, or adjust your filters.</p>
        </div>
      ) : (
        <div className="rounded-xl border shadow-2xs overflow-hidden overflow-x-auto">
          {canManage && checkedIds.size > 0 && (
            <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
              <span className="text-xs font-medium text-foreground">{checkedIds.size} selected</span>
              <div className="flex items-center gap-1">
                {canProcess && (
                  <Button size="sm" variant="ghost" disabled={bulkPending} onClick={bulkReprocess} className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
                    <RefreshCwIcon className="size-3.5" /> Reprocess
                  </Button>
                )}
                <Button size="sm" variant="ghost" disabled={bulkPending} onClick={() => setBulkDeleteConfirmOpen(true)} className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                  <Trash2Icon className="size-3.5" /> Delete
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
                      checked={resumes.length > 0 && resumes.every((r) => checkedIds.has(r.id))}
                      onChange={toggleCheckAll}
                      className="size-4 cursor-pointer accent-primary"
                      aria-label="Select all"
                    />
                  </TableHead>
                )}
                <TableHead>Candidate / File</TableHead>
                {!candidateStatus && <TableHead>Status</TableHead>}
                <TableHead>Criteria Match</TableHead>
                <TableHead>Rank</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Qualification</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumes.map((resume) => (
                <TableRow
                  key={resume.id}
                  onClick={() => setSelectedResumeId(resume.id)}
                  className="cursor-pointer"
                >
                  {canManage && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checkedIds.has(resume.id)}
                        onChange={() => toggleChecked(resume.id)}
                        className="size-4 cursor-pointer accent-primary"
                        aria-label={`Select ${resume.fileName}`}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-2.5 min-w-0">
                      {candidateStatus && CANDIDATE_STATUS_META[candidateStatus] ? (
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-md",
                            CANDIDATE_STATUS_META[candidateStatus].className
                          )}
                        >
                          {(() => {
                            const Icon = CANDIDATE_STATUS_META[candidateStatus].icon
                            return <Icon className="size-4" />
                          })()}
                        </span>
                      ) : (
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <FileTextIcon className="size-4" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate font-medium text-foreground text-xs max-w-48">
                            {resume.candidateName || resume.fileName}
                          </p>
                          {resume.isDuplicate && (
                            <span
                              title="Duplicate of an existing resume"
                              className="inline-flex items-center gap-0.5 rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-600"
                            >
                              <CopyIcon className="size-2.5" /> Duplicate
                            </span>
                          )}
                          {/* The row's icon chip reflects the resume's
                              eligibility verdict, which never changes once the
                              candidate moves on. This badge is what shows how
                              far through the interview workflow they actually
                              are, without opening each one. */}
                          {/* Shortlisted but already invited: waiting on the
                              candidate to pick a slot, not waiting on us. */}
                          {resume.candidateStatus === "shortlisted" && resume.candidateInterviewLinkSentAt && (
                            <span
                              title="Calendly booking link sent — waiting for the candidate to pick a slot"
                              className="inline-flex items-center gap-0.5 rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-600"
                            >
                              <SendIcon className="size-2.5" /> Booking link sent
                            </span>
                          )}
                          {isInInterviewWorkflow(resume.candidateStatus) && (
                            <span
                              className={cn(
                                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize",
                                INTERVIEW_BADGE[resume.candidateStatus!] || "bg-muted text-muted-foreground"
                              )}
                            >
                              <CalendarClockIcon className="size-2.5" />
                              {resume.candidateStatus!.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground max-w-48">{resume.fileName}</p>
                        {resume.errorMessage && (
                          <p className="truncate text-[11px] text-destructive max-w-48">Error: {resume.errorMessage}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  {!candidateStatus && (
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${
                          statusColors[resume.processingStatus] || "bg-muted text-muted-foreground"
                        }`}
                      >
                        {resume.processingStatus === "processing" && (
                          <Loader2Icon className="size-2.5 animate-spin" />
                        )}
                        {resume.processingStatus === "completed" && (
                          <CheckCircle2Icon className="size-2.5 text-emerald-500" />
                        )}
                        {resume.processingStatus === "failed" && (
                          <AlertCircleIcon className="size-2.5 text-red-500" />
                        )}
                        {resume.processingStatus.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                  )}
                  <TableCell className="text-muted-foreground">
                    {resume.criteriaMatchPercentage != null ? `${resume.criteriaMatchPercentage}%` : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {resume.atsScore ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{resume.candidateCity || "—"}</TableCell>
                  <TableCell className="text-muted-foreground truncate max-w-32">{resume.candidateQualification || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {resume.candidateExperienceYears ? `${resume.candidateExperienceYears} yrs` : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{new Date(resume.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {canProcess && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={(e) => handleReprocess(resume, e)}
                          className="text-muted-foreground hover:text-foreground"
                          title="Reprocess resume"
                        >
                          <RefreshCwIcon className="size-3.5" />
                        </Button>
                      )}
                      {resume.hasFile && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            setPreviewResume(resume)
                          }}
                          className="text-muted-foreground hover:text-role-recruitment"
                          title="Preview original PDF"
                        >
                          <EyeIcon className="size-3.5" />
                        </Button>
                      )}
                      {/* Shortlisted only. Before that the decision is whether
                          to interview at all, so a button for preparing one
                          would just be noise on every row. */}
                      {resume.candidateStatus === "shortlisted" && resume.candidateId && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            setQuestionsFor(resume)
                          }}
                          className="text-muted-foreground hover:text-role-recruitment"
                          title="AI interview questions"
                        >
                          <MessageSquareTextIcon className="size-3.5" />
                        </Button>
                      )}
                      {resume.hasFile && (
                        <a
                          href={recruitmentApi.resumes.downloadUrl(resume.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-role-recruitment hover:bg-muted transition-colors"
                          title="Download original resume"
                        >
                          <DownloadIcon className="size-3.5" />
                        </a>
                      )}
                      {canManage && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={(e) => handleDeleteClick(resume, e)}
                          className="text-muted-foreground hover:text-destructive"
                          title="Delete resume"
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      )}
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
            Showing page {meta.page} of {meta.totalPages} ({meta.totalCount} resumes)
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

      <ResumeDetailPanel
        resumeId={selectedResumeId}
        open={!!selectedResumeId}
        onOpenChange={(open) => !open && setSelectedResumeId(null)}
        onOpenCandidate={onOpenCandidate}
      />

      <ResumePreviewModal
        resumeId={previewResume?.id ?? null}
        fileName={previewResume?.fileName}
        contentType={previewResume?.contentType}
        open={!!previewResume}
        onOpenChange={(open) => !open && setPreviewResume(null)}
      />

      {questionsFor?.candidateId && (
        <InterviewQuestionsDialog
          candidateId={questionsFor.candidateId}
          candidateName={questionsFor.candidateName || questionsFor.fileName}
          canGenerate={canManage}
          open
          onOpenChange={(next) => !next && setQuestionsFor(null)}
        />
      )}

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete resume?</DialogTitle>
            <DialogDescription>
              {pendingDelete && (
                <>
                  This will permanently delete <span className="font-medium text-foreground">{pendingDelete.fileName}</span>.
                  This action cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
              Cancel
            </DialogClose>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteResume.isPending}
              className="gap-1.5"
            >
              <Trash2Icon className="size-3.5" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteConfirmOpen} onOpenChange={(open) => !open && setBulkDeleteConfirmOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {checkedIds.size} resume{checkedIds.size === 1 ? "" : "s"}?</DialogTitle>
            <DialogDescription>
              This will permanently delete the selected resumes. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
              Cancel
            </DialogClose>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={confirmBulkDelete}
              disabled={bulkPending}
              className="gap-1.5"
            >
              <Trash2Icon className="size-3.5" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

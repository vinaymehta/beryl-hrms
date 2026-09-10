"use client"

import { useState } from "react"
import { useResume, useResumeMutations, useCandidateMutations } from "../hooks"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  FileTextIcon,
  RefreshCwIcon,
  DownloadIcon,
  AlertCircleIcon,
  SparklesIcon,
  MailIcon,
  PhoneIcon,
  MapPinIcon,
  StarIcon,
  XCircleIcon,
} from "lucide-react"
import { recruitmentApi } from "../api"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@/constants/permissions"
import { cn } from "cn"

interface ResumeDetailPanelProps {
  resumeId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenCandidate?: (candidateId: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  processing: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  failed: "bg-red-500/10 text-red-600 border-red-500/30",
  not_a_resume: "bg-muted text-muted-foreground border-border",
  duplicate: "bg-violet-500/10 text-violet-600 border-violet-500/30",
}

// Candidate (not processing) status — this is the "Needs Review" /
// "Shortlisted" badge next to the candidate's name in the header.
const CANDIDATE_STATUS_COLORS: Record<string, string> = {
  needs_review: "bg-amber-500/10 text-amber-600",
  applied: "bg-blue-500/10 text-blue-600",
  screening: "bg-purple-500/10 text-purple-600",
  interviewing: "bg-indigo-500/10 text-indigo-600",
  shortlisted: "bg-role-recruitment/10 text-role-recruitment",
  offered: "bg-emerald-500/10 text-emerald-600",
  rejected: "bg-muted text-muted-foreground",
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (`${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase()) || "?"
}

/**
 * Right-side panel for a resume — replaces the old centered-modal detail
 * view. Exactly two tabs (Original PDF, AI Summary); the deterministic
 * Criteria Match % and ATS score already live in the Resumes list row, so
 * they aren't repeated here, and there's no raw-JSON/raw-text tab.
 */
export function ResumeDetailPanel({ resumeId, open, onOpenChange, onOpenCandidate }: ResumeDetailPanelProps) {
  const { data: resume, isLoading } = useResume(resumeId || "")
  const { reprocess } = useResumeMutations()
  const { shortlist, reject } = useCandidateMutations()
  const [activeTab, setActiveTab] = useState<"pdf" | "summary">("pdf")
  const canProcess = usePermission([PERMISSIONS.recruitmentManage, PERMISSIONS.resumesProcess])
  const canManage = usePermission([PERMISSIONS.recruitmentManage, PERMISSIONS.candidatesManage])

  if (!resumeId) return null

  const handleReprocess = async () => {
    try {
      await reprocess.mutateAsync(resumeId)
      toast.success("Resume re-queued for AI parsing")
    } catch (err: any) {
      toast.error(err?.message || "Failed to reprocess resume")
    }
  }

  const handleShortlist = async () => {
    if (!resume?.candidate) return
    try {
      await shortlist.mutateAsync(resume.candidate.id)
      toast.success(`${resume.candidate.fullName} marked as Shortlisted`)
    } catch (err: any) {
      toast.error(err?.message || "Failed to shortlist")
    }
  }

  const handleReject = async () => {
    if (!resume?.candidate) return
    try {
      await reject.mutateAsync(resume.candidate.id)
      toast.success(`${resume.candidate.fullName} marked as Rejected`)
    } catch (err: any) {
      toast.error(err?.message || "Failed to reject")
    }
  }

  const aiSummary: string | undefined = resume?.extractedData?.ai_summary
  const skills: { name?: string; category?: string }[] = resume?.extractedData?.skills ?? []
  const qualifications: { degree?: string; field_of_study?: string; institution?: string; year_completed?: number }[] =
    resume?.extractedData?.qualifications ?? []
  const experiences: { job_title?: string; company_name?: string; duration_months?: number }[] =
    resume?.extractedData?.experiences ?? []
  // Zoho attachment metadata frequently reports a generic
  // application/octet-stream content type even for genuine PDFs, so the
  // filename extension is the more reliable signal here.
  const canPreviewInline = resume?.contentType === "application/pdf" || !!resume?.fileName?.toLowerCase().endsWith(".pdf")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[45vw] sm:min-w-180 sm:max-w-275 p-0 gap-0">
        {isLoading || !resume ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b pr-12 bg-muted/20 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="size-12 shrink-0">
                    <AvatarFallback className="bg-role-recruitment/12 text-sm font-semibold text-role-recruitment">
                      {resume.candidate ? initials(resume.candidate.fullName) : <FileTextIcon className="size-5" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <SheetTitle className="text-base font-bold text-foreground truncate">
                        {resume.candidate?.fullName || resume.fileName}
                      </SheetTitle>
                      {resume.candidate && (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize shrink-0",
                            CANDIDATE_STATUS_COLORS[resume.candidate.status] || "bg-muted text-muted-foreground"
                          )}
                        >
                          {resume.candidate.status.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                    {resume.candidate && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {resume.candidate.email && (
                          <span className="inline-flex items-center gap-1">
                            <MailIcon className="size-3" /> {resume.candidate.email}
                          </span>
                        )}
                        {resume.candidate.phone && (
                          <span className="inline-flex items-center gap-1">
                            <PhoneIcon className="size-3" /> {resume.candidate.phone}
                          </span>
                        )}
                        {resume.candidate.city && (
                          <span className="inline-flex items-center gap-1">
                            <MapPinIcon className="size-3" /> {resume.candidate.city}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wider",
                      STATUS_COLORS[resume.processingStatus] || "bg-muted text-muted-foreground"
                    )}
                  >
                    {resume.processingStatus.replace(/_/g, " ")}
                  </span>
                  <span className="truncate max-w-40" title={resume.fileName}>{resume.fileName}</span>
                  <span>•</span>
                  <span>{(resume.fileSize / 1024).toFixed(1)} KB</span>
                  <span>•</span>
                  <span>Added {new Date(resume.createdAt).toLocaleDateString()}</span>
                </div>

              </div>

              {resume.errorMessage && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive flex items-start gap-2">
                  <AlertCircleIcon className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Processing Failure</p>
                    <p className="text-[11px] leading-relaxed">{resume.errorMessage}</p>
                  </div>
                </div>
              )}
            </SheetHeader>

            {/* Exactly two tabs — Original PDF, AI Summary */}
            <div className="border-b px-5 flex items-center gap-4 text-xs pt-2 shrink-0">
              <button
                onClick={() => setActiveTab("pdf")}
                className={cn(
                  "pb-2 font-medium border-b-2 transition-colors flex items-center gap-1.5",
                  activeTab === "pdf" ? "border-role-recruitment text-role-recruitment" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <FileTextIcon className="size-3.5" /> Original PDF
              </button>
              <button
                onClick={() => setActiveTab("summary")}
                className={cn(
                  "pb-2 font-medium border-b-2 transition-colors flex items-center gap-1.5",
                  activeTab === "summary" ? "border-role-recruitment text-role-recruitment" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <SparklesIcon className="size-3.5" /> AI Summary
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 text-xs">
              {activeTab === "pdf" ? (
                canPreviewInline ? (
                  <iframe
                    // #toolbar=0&navpanes=0 suppresses the browser's native
                    // PDF viewer chrome (its own dark toolbar/sidebar) so the
                    // document sits cleanly inside our panel design.
                    src={`${recruitmentApi.resumes.downloadUrl(resume.id)}#toolbar=0&navpanes=0`}
                    title="Original resume PDF"
                    className="h-[65vh] w-full rounded-md border-0 bg-background"
                  />
                ) : (
                  <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-md border border-dashed text-center text-muted-foreground">
                    <FileTextIcon className="size-8 text-muted-foreground/40" />
                    <p>Inline preview isn&apos;t available for this file type.</p>
                    <a
                      href={recruitmentApi.resumes.downloadUrl(resume.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-role-recruitment hover:underline"
                    >
                      Download to view
                    </a>
                  </div>
                )
              ) : (
                <div className="space-y-4">
                  {aiSummary ? (
                    <p className="leading-relaxed text-foreground">{aiSummary}</p>
                  ) : (
                    <p className="text-muted-foreground">No AI summary available yet.</p>
                  )}

                  {skills.length > 0 && (
                    <div className="space-y-2">
                      <p className="border-b pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {skills.map((s, i) => (
                          <span key={i} className="rounded-md border bg-muted px-2 py-0.5 text-[11px] text-foreground">
                            {s.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {qualifications.length > 0 && (
                    <div className="space-y-2">
                      <p className="border-b pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Qualifications</p>
                      <ul className="space-y-1">
                        {qualifications.map((q, i) => (
                          <li key={i} className="text-foreground">
                            {q.degree}
                            {q.field_of_study ? ` in ${q.field_of_study}` : ""} — {q.institution || "—"}
                            {q.year_completed ? ` (${q.year_completed})` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {experiences.length > 0 && (
                    <div className="space-y-2">
                      <p className="border-b pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Experience</p>
                      <ul className="space-y-1">
                        {experiences.map((e, i) => (
                          <li key={i} className="text-foreground">
                            {e.job_title} at {e.company_name}
                            {e.duration_months ? ` (${e.duration_months} mos)` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sticky action bar — quiet utility actions on the left,
                everything building toward a hiring decision grouped on the
                right in ascending order of weight, Shortlist as the final,
                most prominent action. */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-background p-3 shrink-0">
              <div className="flex flex-wrap items-center gap-0.5">
                {resume.candidate && onOpenCandidate && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onOpenCandidate(resume.candidate!.id)}
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  >
                    View Candidate →
                  </Button>
                )}
                {canProcess && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleReprocess}
                    disabled={reprocess.isPending}
                    className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCwIcon className={cn("size-3.5", reprocess.isPending && "animate-spin")} />
                    Reprocess
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {resume.hasFile && (
                  <a
                    href={recruitmentApi.resumes.downloadUrl(resume.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <DownloadIcon className="size-3.5" />
                    Download
                  </a>
                )}
                {canManage && resume.candidate && resume.candidate.status !== "rejected" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReject}
                    disabled={reject.isPending}
                    className="gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/30"
                  >
                    <XCircleIcon className="size-3.5" />
                    Reject
                  </Button>
                )}
                {canManage && resume.candidate && resume.candidate.status !== "shortlisted" && (
                  <Button
                    size="sm"
                    onClick={handleShortlist}
                    disabled={shortlist.isPending}
                    className="gap-1.5 bg-role-recruitment text-role-recruitment-foreground hover:bg-role-recruitment/90 shadow-2xs"
                  >
                    <StarIcon className="size-3.5" />
                    Shortlist
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

"use client"

import { useState } from "react"
import { useResume, useResumeMutations, useCandidateMutations } from "../hooks"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ResumePreviewModal } from "./resume-preview-modal"
import { InterviewSchedulerDialog } from "./interview-scheduler-dialog"
import { CandidatePersonalInfo } from "./candidate-personal-info"
import { isInInterviewWorkflow } from "@/types/recruitment"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  FileTextIcon,
  RefreshCwIcon,
  DownloadIcon,
  AlertCircleIcon,
  MailIcon,
  PhoneIcon,
  MapPinIcon,
  StarIcon,
  XCircleIcon,
  CheckCircle2Icon,
  MinusCircleIcon,
  CopyIcon,
  CalendarClockIcon,
  UserCheckIcon,
  MessageSquareIcon,
  ClipboardCheckIcon,
  Loader2Icon,
} from "lucide-react"
import { recruitmentApi } from "../api"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@/constants/permissions"
import { cn } from "cn"
import { errorMessage } from "@/lib/errors"

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
  interview_scheduled: "bg-cyan-500/10 text-cyan-600",
  interview_completed: "bg-teal-500/10 text-teal-600",
  feedback_received: "bg-emerald-500/10 text-emerald-600",
  feedback_not_received: "bg-orange-500/10 text-orange-600",
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (`${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase()) || "?"
}

// Tri-state (true = confirmed pass, false = confirmed fail, null/undefined =
// unreadable/not confirmed) — never coerced, matching
// Recruitment::EligibilityEvaluator on the backend.
function CriterionBadge({ label, value }: { label: string; value: boolean | null | undefined }) {
  const config =
    value === true
      ? { icon: CheckCircle2Icon, text: "Confirmed", className: "bg-emerald-500/10 text-emerald-600" }
      : value === false
        ? { icon: XCircleIcon, text: "Not met", className: "bg-red-500/10 text-red-600" }
        : { icon: MinusCircleIcon, text: "Unreadable", className: "bg-muted text-muted-foreground" }
  const Icon = config.icon
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", config.className)}>
        <Icon className="size-3" />
        {config.text}
      </span>
    </div>
  )
}

/**
 * Modal with the candidate/eligibility view of a resume — AI Summary, the
 * deterministic eligibility criteria, and the interview workflow. Shortlisting
 * is automatic (Recruitment::EligibilityEvaluator), so it is not an action here.
 * The original PDF is a separate, dedicated action (ResumePreviewModal) from
 * the Resumes list, so it isn't duplicated here.
 */
export function ResumeDetailPanel({ resumeId, open, onOpenChange, onOpenCandidate }: ResumeDetailPanelProps) {
  const { data: resume, isLoading } = useResume(resumeId || "")
  const { reprocess } = useResumeMutations()
  const { shortlist, reject, setStatus, requestFeedback } = useCandidateMutations()
  const canProcess = usePermission([PERMISSIONS.recruitmentManage, PERMISSIONS.resumesProcess])
  const canManage = usePermission([PERMISSIONS.recruitmentManage, PERMISSIONS.candidatesManage])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [schedulerOpen, setSchedulerOpen] = useState(false)
  const [tab, setTab] = useState<"summary" | "personal">("summary")

  if (!resumeId) return null

  const handleReprocess = async () => {
    try {
      await reprocess.mutateAsync(resumeId)
      toast.success("Resume re-queued for AI parsing")
    } catch (err) {
      toast.error(errorMessage(err, "Failed to reprocess resume"))
    }
  }

  // Only reachable from a rejected candidate — see the button's comment.
  const handleShortlist = async () => {
    if (!resume?.candidate) return
    try {
      await shortlist.mutateAsync(resume.candidate.id)
      toast.success(`${resume.candidate.fullName} moved back to Shortlisted`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to move back to Shortlisted")
    }
  }

  const handleReject = async () => {
    if (!resume?.candidate) return
    try {
      await reject.mutateAsync(resume.candidate.id)
      toast.success(`${resume.candidate.fullName} marked as Rejected`)
    } catch (err) {
      toast.error(errorMessage(err, "Failed to reject"))
    }
  }

  const handleMarkInterviewCompleted = async () => {
    if (!resume?.candidate) return
    try {
      await setStatus.mutateAsync({ id: resume.candidate.id, status: "interview_completed" })
      toast.success("Interview marked as completed")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update the interview")
    }
  }

  // Always an explicit admin action — nothing requests feedback on its own.
  const handleRequestFeedback = async () => {
    if (!resume?.candidate) return
    try {
      await requestFeedback.mutateAsync(resume.candidate.id)
      toast.success("Feedback request sent", {
        description: resume.candidate.email
          ? `Sent to ${resume.candidate.email}`
          : "No email on file — the candidate was marked as awaiting feedback, but nothing was sent.",
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send the feedback request")
    }
  }

  const handleFeedbackReceived = async () => {
    if (!resume?.candidate) return
    try {
      await setStatus.mutateAsync({ id: resume.candidate.id, status: "feedback_received" })
      toast.success("Feedback marked as received")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update feedback status")
    }
  }

  const candidateStatus = resume?.candidate?.status
  const inInterviewWorkflow = isInInterviewWorkflow(candidateStatus)
  const interviewAt = resume?.candidate?.interviewAt ?? null
  const interviewPending = setStatus.isPending || requestFeedback.isPending

  const aiSummary: string | undefined = resume?.extractedData?.ai_summary
  const skills: { name?: string; category?: string }[] = resume?.extractedData?.skills ?? []
  const qualifications: { degree?: string; field_of_study?: string; institution?: string; year_completed?: number }[] =
    resume?.extractedData?.qualifications ?? []
  const experiences: { job_title?: string; company_name?: string; duration_months?: number }[] =
    resume?.extractedData?.experiences ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:w-[70vw] sm:max-w-[70vw] max-h-[92vh] p-0 gap-0 flex flex-col overflow-hidden">
        {isLoading || !resume ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <DialogHeader className="border-b p-5 pr-12 bg-muted/20 space-y-3 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="size-12 shrink-0">
                    <AvatarFallback className="bg-role-recruitment/12 text-sm font-semibold text-role-recruitment">
                      {resume.candidate ? initials(resume.candidate.fullName) : <FileTextIcon className="size-5" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <DialogTitle className="text-base font-bold text-foreground truncate">
                        {resume.candidate?.fullName || resume.fileName}
                      </DialogTitle>
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

              {resume.isDuplicate && (
                <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-2.5 text-xs text-violet-700 dark:text-violet-400 flex items-start gap-2">
                  <CopyIcon className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Duplicate Resume Detected</p>
                    <p className="text-[11px] leading-relaxed text-violet-700/80 dark:text-violet-400/80">
                      This file matches a resume already on file — it was not re-imported as a new submission.
                    </p>
                  </div>
                </div>
              )}
            </DialogHeader>

            {/* Deterministic eligibility criteria — always visible regardless
                of which tab is active, so it's clear exactly why this
                resume landed at its current Criteria Match %. */}
            <div className="border-b bg-muted/10 p-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Eligibility Criteria {resume.criteriaMatchPercentage != null && `— ${resume.criteriaMatchPercentage}% Match`}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <CriterionBadge label="Qualification" value={resume.eligibilityBreakdown?.qualification} />
                <CriterionBadge label="Marks (> 60%)" value={resume.eligibilityBreakdown?.marks} />
                <CriterionBadge label="Graduation Year" value={resume.eligibilityBreakdown?.graduation_year} />
                <CriterionBadge label="No Active Backlogs" value={resume.eligibilityBreakdown?.backlog} />
              </div>
            </div>

            {/* Interview stage — only once there is one. The interviewer IS
                shown here: this is the internal view. It is only the
                candidate's email that deliberately leaves them out. */}
            {inInterviewWorkflow && (
              <div className="border-b bg-cyan-500/5 p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Interview</p>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-foreground">
                    <CalendarClockIcon className="size-3.5 text-muted-foreground" />
                    {interviewAt
                      ? new Date(interviewAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "Not scheduled"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-foreground">
                    <UserCheckIcon className="size-3.5 text-muted-foreground" />
                    {resume.candidate?.interviewerName || "No interviewer assigned"}
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">internal</span>
                  </span>
                  {resume.candidate?.feedbackRequestedAt && (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <MessageSquareIcon className="size-3.5" />
                      Feedback requested {new Date(resume.candidate.feedbackRequestedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Same hand-rolled tab pattern the rest of the app uses (see
                department-designation-manager.tsx) — no shared Tabs primitive
                exists. */}
            <div className="border-b px-5 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-4">
                {([
                  { id: "summary", label: "AI Summary" },
                  { id: "personal", label: "Personal Info" },
                ] as const).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "relative py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors",
                      tab === t.id ? "text-role-recruitment" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t.label}
                    {tab === t.id && (
                      <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-role-recruitment" />
                    )}
                  </button>
                ))}
              </div>
              {resume.hasFile && (
                <button
                  onClick={() => setPreviewOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-role-recruitment hover:underline"
                >
                  <FileTextIcon className="size-3.5" />
                  View Original PDF
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-5 text-xs">
              {tab === "personal" ? (
                resume.candidate ? (
                  <CandidatePersonalInfo candidateId={resume.candidate.id} canManage={canManage} />
                ) : (
                  <p className="text-muted-foreground">
                    This resume isn&apos;t linked to a candidate yet, so there is no profile to show.
                  </p>
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

            <ResumePreviewModal
              resumeId={resume.id}
              fileName={resume.fileName}
              contentType={resume.contentType}
              open={previewOpen}
              onOpenChange={setPreviewOpen}
            />

            {/* Mounted only while open, and keyed by the interview it's
                editing, so the form always initializes from the candidate's
                current booking instead of carrying over a previous edit. */}
            {resume.candidate && schedulerOpen && (
              <InterviewSchedulerDialog
                key={`${resume.candidate.id}:${resume.candidate.interviewLinkSentAt ?? "new"}`}
                open={schedulerOpen}
                onOpenChange={setSchedulerOpen}
                candidateId={resume.candidate.id}
                candidateName={resume.candidate.fullName}
                candidateEmail={resume.candidate.email}
                interviewLinkSentAt={resume.candidate.interviewLinkSentAt}
                interviewerId={resume.candidate.interviewerId}
                interviewerName={resume.candidate.interviewerName}
              />
            )}

            {/* Sticky action bar — quiet utility actions on the left,
                everything building toward a hiring decision grouped on the
                right in ascending order of weight, the candidate's next
                interview step as the final, most prominent action. */}
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
                {/* Shortlist is offered ONLY to move a rejected candidate
                    back — the reverse of Reject. It is deliberately absent
                    everywhere else: shortlisting is decided automatically by
                    Recruitment::EligibilityEvaluator when a resume is
                    processed, so a general button would duplicate or silently
                    override that. Reject has no such counterpart (the
                    evaluator never rejects on its own), which is why the two
                    are not symmetrical. */}
                {canManage && resume.candidate && resume.candidate.status === "rejected" && (
                  <Button
                    size="sm"
                    onClick={handleShortlist}
                    disabled={shortlist.isPending}
                    className="gap-1.5 bg-role-recruitment text-role-recruitment-foreground hover:bg-role-recruitment/90 shadow-2xs"
                  >
                    <StarIcon className="size-3.5" />
                    Move to Shortlisted
                  </Button>
                )}

                {/* Interview workflow, one stage at a time: the only action
                    offered is the next legitimate step from where the
                    candidate actually is. */}
                {canManage && resume.candidate && candidateStatus === "shortlisted" && (
                  <Button
                    size="sm"
                    onClick={() => setSchedulerOpen(true)}
                    className="gap-1.5 bg-role-recruitment text-role-recruitment-foreground hover:bg-role-recruitment/90 shadow-2xs"
                  >
                    <CalendarClockIcon className="size-3.5" />
                    {resume.candidate.interviewLinkSentAt ? "Resend booking link" : "Schedule Interview"}
                  </Button>
                )}

                {canManage && resume.candidate && candidateStatus === "interview_scheduled" && (
                  <>
                    <Button
                      size="sm"
                      onClick={handleMarkInterviewCompleted}
                      disabled={interviewPending}
                      className="gap-1.5 bg-role-recruitment text-role-recruitment-foreground hover:bg-role-recruitment/90 shadow-2xs"
                    >
                      {interviewPending ? (
                        <Loader2Icon className="size-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2Icon className="size-3.5" />
                      )}
                      Interview Completed
                    </Button>
                  </>
                )}

                {canManage && resume.candidate && candidateStatus === "interview_completed" && (
                  <Button
                    size="sm"
                    onClick={handleRequestFeedback}
                    disabled={interviewPending}
                    className="gap-1.5 bg-role-recruitment text-role-recruitment-foreground hover:bg-role-recruitment/90 shadow-2xs"
                  >
                    {interviewPending ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      <MessageSquareIcon className="size-3.5" />
                    )}
                    Send Feedback Request
                  </Button>
                )}

                {canManage && resume.candidate && candidateStatus === "feedback_not_received" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRequestFeedback}
                      disabled={interviewPending}
                      className="gap-1.5"
                    >
                      <MessageSquareIcon className="size-3.5" />
                      Resend Request
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleFeedbackReceived}
                      disabled={interviewPending}
                      className="gap-1.5 bg-role-recruitment text-role-recruitment-foreground hover:bg-role-recruitment/90 shadow-2xs"
                    >
                      {interviewPending ? (
                        <Loader2Icon className="size-3.5 animate-spin" />
                      ) : (
                        <ClipboardCheckIcon className="size-3.5" />
                      )}
                      Feedback Received
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

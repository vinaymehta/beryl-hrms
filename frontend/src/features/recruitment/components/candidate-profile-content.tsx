"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useCandidate, useCandidateMutations } from "../hooks"
import type { CandidateSkill } from "@/types/recruitment"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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
  MapPinIcon,
  MailIcon,
  PhoneIcon,
  BriefcaseIcon,
  GraduationCapIcon,
  FileTextIcon,
  XCircleIcon,
  StarIcon,
  ClockIcon,
  SparklesIcon,
  ExternalLinkIcon,
  LayersIcon,
  AwardIcon,
  GlobeIcon,
  AlertTriangleIcon,
  CheckIcon,
  XIcon,
  BuildingIcon,
  Trash2Icon,
} from "lucide-react"
import { recruitmentApi } from "../api"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@/constants/permissions"
import { errorMessage } from "@/lib/errors"

const statusColors: Record<string, string> = {
  needs_review: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  shortlisted: "bg-role-recruitment/10 text-role-recruitment border-role-recruitment/30",
  applied: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  screening: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  interviewing: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30",
  offered: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  rejected: "bg-muted text-muted-foreground border-border",
  // Interview workflow — one hue per stage, shared with every other
  // candidate-status badge in the app.
  interview_scheduled: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
  interview_completed: "bg-teal-500/10 text-teal-600 border-teal-500/30",
  feedback_received: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  feedback_not_received: "bg-orange-500/10 text-orange-600 border-orange-500/30",
}

// Shared candidate profile body — rendered inside a Dialog by
// CandidateDetailModal (quick-look from a list) and as a full page at
// /recruitment/candidates/[id] (bookmarkable, deep-linkable profile URL).
export function CandidateProfileContent({ candidateId }: { candidateId: string }) {
  const router = useRouter()
  const { data: candidate, isLoading } = useCandidate(candidateId)
  const { shortlist, reject, deleteCandidate, confirmDuplicate, dismissDuplicate } = useCandidateMutations()
  const canManage = usePermission([PERMISSIONS.recruitmentManage, PERMISSIONS.candidatesManage])
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // Only reachable from a rejected candidate — see the button's comment.
  const handleShortlist = async () => {
    try {
      await shortlist.mutateAsync(candidateId)
      toast.success("Candidate moved back to Shortlisted")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to move back to Shortlisted")
    }
  }

  const handleReject = async () => {
    try {
      await reject.mutateAsync(candidateId)
      toast.info("Candidate marked as Rejected")
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update status"))
    }
  }

  const handleDelete = async () => {
    try {
      await deleteCandidate.mutateAsync(candidateId)
      toast.success("Candidate deleted")
      router.push("/recruitment")
    } catch (err) {
      toast.error(errorMessage(err, "Failed to delete candidate"))
    } finally {
      setConfirmingDelete(false)
    }
  }

  const handleConfirmDuplicate = async () => {
    try {
      await confirmDuplicate.mutateAsync(candidateId)
      toast.success("Marked as a confirmed duplicate")
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update duplicate status"))
    }
  }

  const handleDismissDuplicate = async () => {
    try {
      await dismissDuplicate.mutateAsync(candidateId)
      toast.success("Duplicate flag dismissed")
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update duplicate status"))
    }
  }

  if (isLoading || !candidate) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="border-b p-5 pr-12 bg-muted/20 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">{candidate.fullName}</h2>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                  statusColors[candidate.status] || "bg-muted text-muted-foreground"
                }`}
              >
                {candidate.status.replace("_", " ")}
              </span>

              {candidate.duplicateStatus === "potential_duplicate" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                  Duplicate Flag
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              {candidate.currentRole && (
                <span className="font-medium text-foreground">{candidate.currentRole}</span>
              )}
              {candidate.city && (
                <span className="flex items-center gap-1">
                  <MapPinIcon className="size-3 text-muted-foreground" />
                  {candidate.city}
                  {candidate.country ? `, ${candidate.country}` : ""}
                </span>
              )}
              <span>•</span>
              <span>{candidate.experienceYears} Years Exp</span>
              {candidate.highestQualification && (
                <>
                  <span>•</span>
                  <span>{candidate.highestQualification}</span>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Shortlist appears ONLY for a rejected candidate, as the
                reverse of Reject. Not offered otherwise: shortlisting is
                decided automatically by Recruitment::EligibilityEvaluator, and
                for someone already in the interview workflow it would drop
                them back out of it. */}
            {canManage && candidate.status === "rejected" && (
              <Button size="sm" onClick={handleShortlist} className="text-xs gap-1 shadow-2xs">
                <StarIcon className="size-3.5" />
                Move to Shortlisted
              </Button>
            )}

            {canManage && candidate.status !== "rejected" && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleReject}
                className="text-xs text-muted-foreground hover:text-destructive gap-1"
              >
                <XCircleIcon className="size-3.5" />
                Reject
              </Button>
            )}

            {canManage && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmingDelete(true)}
                className="size-8 p-0 text-muted-foreground hover:text-destructive"
                title="Delete candidate"
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Duplicate Review — human decision only, never automatic */}
        {canManage && candidate.duplicateStatus === "potential_duplicate" && (
          <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
            <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
              <AlertTriangleIcon className="size-3.5" />
              This candidate may be a duplicate of another record — review before proceeding.
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button size="sm" variant="outline" onClick={handleDismissDuplicate} className="h-7 text-[11px] gap-1">
                <XIcon className="size-3" /> Not a duplicate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleConfirmDuplicate}
                className="h-7 text-[11px] gap-1 text-amber-700 dark:text-amber-400 border-amber-500/40"
              >
                <CheckIcon className="size-3" /> Confirm duplicate
              </Button>
            </div>
          </div>
        )}

        {/* Contact Information */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
          {candidate.email && (
            <a
              href={`mailto:${candidate.email}`}
              className="flex items-center gap-1 text-foreground/80 hover:text-role-recruitment transition-colors"
            >
              <MailIcon className="size-3.5" />
              {candidate.email}
            </a>
          )}
          {candidate.phone && (
            <a
              href={`tel:${candidate.phone}`}
              className="flex items-center gap-1 text-foreground/80 hover:text-role-recruitment transition-colors"
            >
              <PhoneIcon className="size-3.5" />
              {candidate.phone}
            </a>
          )}
          {candidate.noticePeriod && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <ClockIcon className="size-3.5" />
              Notice: {candidate.noticePeriod}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-5 text-xs">
        {/* Location & Preferences */}
        {(candidate.state || candidate.country || candidate.currentLocation || candidate.preferredLocation) && (
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
              <MapPinIcon className="size-3.5 text-muted-foreground" />
              Location & Preferences
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {candidate.state && (
                <div className="rounded-lg border bg-card p-2 space-y-0.5">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">State</p>
                  <p className="font-medium text-foreground">{candidate.state}</p>
                </div>
              )}
              {candidate.country && (
                <div className="rounded-lg border bg-card p-2 space-y-0.5">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Country</p>
                  <p className="font-medium text-foreground">{candidate.country}</p>
                </div>
              )}
              {candidate.currentLocation && (
                <div className="rounded-lg border bg-card p-2 space-y-0.5">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Current Location</p>
                  <p className="font-medium text-foreground">{candidate.currentLocation}</p>
                </div>
              )}
              {candidate.preferredLocation && (
                <div className="rounded-lg border bg-card p-2 space-y-0.5">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Preferred Location</p>
                  <p className="font-medium text-foreground">{candidate.preferredLocation}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Industry & Languages */}
        {(candidate.industry || (candidate.languages && candidate.languages.length > 0)) && (
          <div className="flex flex-wrap items-center gap-4">
            {candidate.industry && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <BuildingIcon className="size-3.5 text-muted-foreground" />
                <span className="font-medium text-foreground">{candidate.industry}</span>
                <span className="text-[10px]">Industry / Domain</span>
              </span>
            )}
            {candidate.languages && candidate.languages.length > 0 && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <GlobeIcon className="size-3.5 text-muted-foreground" />
                <span className="font-medium text-foreground">{candidate.languages.join(", ")}</span>
              </span>
            )}
          </div>
        )}

        {/* AI-Generated Summary — extracted from the resume, not a job-specific match */}
        {candidate.notes && (
          <div className="rounded-lg border bg-role-recruitment/8 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
                <SparklesIcon className="size-3.5 text-role-recruitment" />
                <span>AI-Generated Summary</span>
              </div>
              <span className="text-[10px] text-muted-foreground italic">From resume extraction — decision-support only</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{candidate.notes}</p>
          </div>
        )}

        {/* Skills with Provenance */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
              <LayersIcon className="size-3.5 text-muted-foreground" />
              Extracted Skills & Capabilities
            </h4>
            <span className="text-[10px] text-muted-foreground">Confidence & provenance tracked</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {candidate.skills && candidate.skills.length > 0 ? (
              candidate.skills.map((s: CandidateSkill | string, idx: number) => {
                const skillName = typeof s === "string" ? s : s.name
                const provenance = typeof s === "string" ? "explicit" : s.provenance
                return (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs font-medium text-foreground shadow-2xs"
                  >
                    {skillName}
                    {provenance === "explicit" ? (
                      <span title="Explicitly stated in resume" className="size-1.5 rounded-full bg-emerald-500" />
                    ) : (
                      <span title="Inferred by AI from experience" className="size-1.5 rounded-full bg-blue-500" />
                    )}
                  </span>
                )
              })
            ) : (
              <p className="text-muted-foreground text-xs">No skills recorded.</p>
            )}
          </div>
        </div>

        {/* Work Experience Timeline */}
        <div className="space-y-2">
          <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
            <BriefcaseIcon className="size-3.5 text-purple-500" />
            Work Experience
          </h4>
          {candidate.experiences && candidate.experiences.length > 0 ? (
            <div className="space-y-2.5">
              {candidate.experiences.map((exp) => (
                <div key={exp.id} className="rounded-lg border bg-card p-3 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{exp.jobTitle}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {exp.startDate ? new Date(exp.startDate).getFullYear() : ""}
                      {" — "}
                      {exp.isCurrent ? "Present" : exp.endDate ? new Date(exp.endDate).getFullYear() : ""}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">{exp.companyName}</p>
                  {exp.description && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{exp.description}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">No experience items detailed.</p>
          )}
        </div>

        {/* Education & Qualifications */}
        <div className="space-y-2">
          <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
            <GraduationCapIcon className="size-3.5 text-blue-500" />
            Education & Qualifications
          </h4>
          {candidate.qualifications && candidate.qualifications.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {candidate.qualifications.map((q) => (
                <div key={q.id} className="rounded-lg border bg-card p-2.5 shadow-2xs space-y-0.5">
                  <p className="font-semibold text-foreground">{q.degree}</p>
                  {q.fieldOfStudy && <p className="text-xs text-muted-foreground">{q.fieldOfStudy}</p>}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <span>{q.institution}</span>
                    {q.yearCompleted && <span>{q.yearCompleted}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">No qualifications detailed.</p>
          )}
        </div>

        {/* Certifications */}
        <div className="space-y-2">
          <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
            <AwardIcon className="size-3.5 text-emerald-500" />
            Certifications
          </h4>
          {candidate.certifications && candidate.certifications.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {candidate.certifications.map((c) => (
                <div key={c.id} className="rounded-lg border bg-card p-2.5 shadow-2xs space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-foreground">{c.name}</p>
                    <span
                      title={c.provenance === "explicit" ? "Explicitly stated in resume" : "Inferred by AI"}
                      className={`size-1.5 rounded-full ${c.provenance === "explicit" ? "bg-emerald-500" : "bg-blue-500"}`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{c.issuingOrganization || "—"}</span>
                    {c.issueDate && <span>{new Date(c.issueDate).getFullYear()}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">No certifications detailed.</p>
          )}
        </div>

        {/* Resumes Ingested — Processing Information & Source */}
        <div className="space-y-2 pt-2 border-t">
          <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
            <FileTextIcon className="size-3.5 text-muted-foreground" />
            Ingested Resumes, Provenance & Processing
          </h4>
          {candidate.resumes && candidate.resumes.length > 0 ? (
            <div className="space-y-1.5">
              {candidate.resumes.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-xs gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileTextIcon className="size-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{r.fileName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Ingested {new Date(r.createdAt).toLocaleDateString()} • Source: {r.source.replace("_", " ")}
                        {r.sourceEmailId && " (Zoho Mail)"}
                      </p>
                      {r.errorMessage && (
                        <p className="text-[10px] text-destructive truncate">Error: {r.errorMessage}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold capitalize border">
                      {r.processingStatus.replace("_", " ")}
                    </span>
                    {r.hasFile && (
                      <a
                        href={recruitmentApi.resumes.downloadUrl(r.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:text-role-recruitment transition-colors shadow-2xs"
                      >
                        <ExternalLinkIcon className="size-3" />
                        View
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">No attached resumes found.</p>
          )}
        </div>
      </div>

      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete candidate?</DialogTitle>
            <DialogDescription>
              This will permanently delete <span className="font-medium text-foreground">{candidate.fullName}</span> and
              all their attached resumes, skills, and history. This action cannot be undone.
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
              onClick={handleDelete}
              disabled={deleteCandidate.isPending}
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

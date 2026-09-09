"use client"

import { useState } from "react"
import { useJobs, useJob, useJobMutations } from "../hooks"
import { CandidateDetailModal } from "./candidate-detail-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  BriefcaseIcon,
  SparklesIcon,
  PlusIcon,
  StarIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  Loader2Icon,
  BrainIcon,
  UserCheckIcon,
  ArrowRightIcon,
  XIcon,
} from "lucide-react"
import type { Job, JobStatus, MatchStatus } from "@/types/recruitment"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@/constants/permissions"

interface JobsMatchingViewProps {
  onOpenCandidate?: (candidateId: string) => void
}

// Match score is a ranking signal, not decoration — color communicates
// strength (strong/moderate/weak) instead of one flat accent for every card.
function scoreTint(score: number) {
  if (score >= 80) return "bg-emerald-500/10 text-emerald-600"
  if (score >= 60) return "bg-amber-500/10 text-amber-600"
  return "bg-muted text-muted-foreground"
}

export function JobsMatchingView({ onOpenCandidate }: JobsMatchingViewProps) {
  const { data: jobs, isLoading: jobsLoading } = useJobs()
  const canManageJobs = usePermission([PERMISSIONS.recruitmentManage, PERMISSIONS.jobsManage])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)

  // Form state for creating job
  const [newTitle, setNewTitle] = useState("")
  const [newMinExp, setNewMinExp] = useState("3")
  const [newSkills, setNewSkills] = useState("")
  const [newDesc, setNewDesc] = useState("")

  const activeJobId = selectedJobId || (jobs && jobs.length > 0 ? jobs[0].id : null)
  const { data: activeJob, isLoading: jobLoading } = useJob(activeJobId || "")
  const { createJob, matchCandidates, updateMatch } = useJobMutations()

  const handleCreateJob = async () => {
    if (!newTitle.trim()) {
      toast.error("Please enter a job title")
      return
    }

    try {
      const skillsArray = newSkills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)

      const created = await createJob.mutateAsync({
        title: newTitle.trim(),
        minExperience: parseFloat(newMinExp) || 0,
        requiredSkills: skillsArray,
        description: newDesc.trim(),
        status: "open",
      })

      toast.success("Job posting created")
      setCreateModalOpen(false)
      setSelectedJobId(created.id)
      setNewTitle("")
      setNewSkills("")
      setNewDesc("")
    } catch (err: any) {
      toast.error(err?.message || "Failed to create job")
    }
  }

  const handleRunMatch = async (jobId: string) => {
    try {
      toast.info("Evaluating candidates against job requirements with Claude AI...")
      const res: any = await matchCandidates.mutateAsync({ id: jobId })
      const count = res?.meta?.matchedCandidatesCount ?? 0
      toast.success(`AI evaluation complete! Matched ${count} candidate(s).`)
    } catch (err: any) {
      toast.error(err?.message || "Failed to match candidates")
    }
  }

  const handleUpdateMatchStatus = async (
    jobId: string,
    matchId: string,
    status: MatchStatus
  ) => {
    try {
      await updateMatch.mutateAsync({ jobId, matchId, status })
      toast.success(`Candidate match updated to ${status}`)
    } catch (err: any) {
      toast.error(err?.message || "Failed to update match status")
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-3">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <BrainIcon className="size-4 text-role-recruitment" />
            AI Candidate Matching & Scoring
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Evaluate candidate profiles against job requirements using Claude AI decision support.
          </p>
        </div>

        {canManageJobs && (
          <Button
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="text-xs gap-1.5 shadow-2xs self-start sm:self-auto"
          >
            <PlusIcon className="size-3.5" />
            Create Job Opening
          </Button>
        )}
      </div>

      {/* Main Layout: Job Selector Tabs/List + Detail Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Job Openings List */}
        <div className="lg:col-span-4 space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Job Openings ({jobs?.length ?? 0})
          </span>

          {jobsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ) : !jobs || jobs.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
              No jobs created yet. Click &ldquo;Create Job Opening&rdquo; to begin matching candidates.
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {jobs.map((j) => {
                const isSelected = j.id === activeJobId
                return (
                  <div
                    key={j.id}
                    onClick={() => setSelectedJobId(j.id)}
                    className={`rounded-lg border p-3.5 cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-xs"
                        : "bg-card hover:border-role-recruitment/30 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-xs text-foreground truncate">{j.title}</h4>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 capitalize shrink-0">
                        {j.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground mt-1">
                      Min {j.minExperience} yrs exp • {j.requiredSkills?.length ?? 0} skills required
                    </p>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t text-[10px] text-muted-foreground">
                      <span>Matches: {j.totalMatchesCount}</span>
                      <span className="font-semibold text-role-recruitment">
                        {j.shortlistedCount} Shortlisted
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Column: Active Job Details & Evaluated Matches */}
        <div className="lg:col-span-8 space-y-4">
          {jobLoading || !activeJob ? (
            <div className="space-y-3">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-44 w-full rounded-lg" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Job Summary Banner */}
              <div className="rounded-xl border bg-card p-4 space-y-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-foreground">{activeJob.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Min Experience: {activeJob.minExperience} Years • Department:{" "}
                      {activeJob.departmentName || "General"}
                    </p>
                  </div>

                  {canManageJobs && (
                    <Button
                      size="sm"
                      onClick={() => handleRunMatch(activeJob.id)}
                      disabled={matchCandidates.isPending}
                      className="text-xs gap-1.5 shadow-2xs self-start sm:self-auto"
                    >
                      {matchCandidates.isPending ? (
                        <>
                          <Loader2Icon className="size-3.5 animate-spin" /> Evaluating...
                        </>
                      ) : (
                        <>
                          <SparklesIcon className="size-3.5" /> Run AI Match
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {activeJob.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {activeJob.description}
                  </p>
                )}

                {activeJob.requiredSkills && activeJob.requiredSkills.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 pt-1">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Required Skills:
                    </span>
                    {activeJob.requiredSkills.map((sk, idx) => (
                      <span
                        key={idx}
                        className="rounded-md border bg-muted/30 px-2 py-0.5 text-xs font-medium text-foreground"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Matches List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Ranked Candidates ({activeJob.matches?.length ?? 0})
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Ranked by AI match score
                  </span>
                </div>

                {!activeJob.matches || activeJob.matches.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-10 text-center text-xs text-muted-foreground space-y-2">
                    <SparklesIcon className="size-8 text-role-recruitment/40 mx-auto" />
                    <p className="font-semibold text-foreground text-sm">
                      No candidate matches computed yet
                    </p>
                    <p className="max-w-sm mx-auto">
                      Click &ldquo;Run AI Match&rdquo; above to evaluate your candidate pool against this job description.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeJob.matches.map((m) => (
                      <Card
                        key={m.id}
                        className="hover:border-role-recruitment/30 transition-colors shadow-2xs"
                      >
                        <CardContent className="p-4 space-y-3">
                          {/* Top Row: Candidate info + Match Score Badge */}
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-sm text-foreground">
                                  {m.candidateName}
                                </h4>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                    m.status === "shortlisted"
                                      ? "bg-role-recruitment/10 text-role-recruitment"
                                      : m.status === "rejected"
                                      ? "bg-muted text-muted-foreground"
                                      : "bg-blue-500/10 text-blue-600"
                                  }`}
                                >
                                  {m.status}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {m.candidateRole || "Candidate"} • {m.candidateExperience} Yrs Exp •{" "}
                                {m.candidateCity || "Location not set"}
                              </p>
                            </div>

                            {/* Score Display */}
                            <div className="text-right shrink-0">
                              <div className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm font-extrabold ${scoreTint(m.matchScore)}`}>
                                <StarIcon className="size-3.5 fill-current" />
                                {m.matchScore}%
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5">Match Score</p>
                            </div>
                          </div>

                          {/* Breakdown Scores */}
                          <div className="grid grid-cols-3 gap-2 text-center text-xs bg-muted/20 rounded-lg p-2">
                            <div>
                              <span className="text-[10px] text-muted-foreground block">Skills</span>
                              <span className="font-bold text-foreground">{m.skillsScore}%</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground block">Experience</span>
                              <span className="font-bold text-foreground">{m.experienceScore}%</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground block">Qualification</span>
                              <span className="font-bold text-foreground">{m.qualificationScore}%</span>
                            </div>
                          </div>

                          {/* Strong Matches & Gaps */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {m.strongMatches && m.strongMatches.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                  <CheckCircle2Icon className="size-3" /> Strong Matches
                                </span>
                                <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                                  {m.strongMatches.map((sm, i) => (
                                    <li key={i} className="truncate">
                                      • {sm}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {m.potentialGaps && m.potentialGaps.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                                  <AlertTriangleIcon className="size-3" /> Potential Gaps
                                </span>
                                <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                                  {m.potentialGaps.map((pg, i) => (
                                    <li key={i} className="truncate">
                                      • {pg}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>

                          {/* Objective AI Explanation */}
                          {m.aiExplanation && (
                            <p className="text-[11px] leading-relaxed text-muted-foreground bg-background p-2.5 rounded-md border italic">
                              &ldquo;{m.aiExplanation}&rdquo;
                            </p>
                          )}

                          {/* Match Action Bar */}
                          <div className="flex items-center justify-between pt-2 border-t text-xs">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedCandidateId(m.candidateId)}
                              className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                            >
                              Full Profile <ArrowRightIcon className="size-3" />
                            </Button>

                            <div className="flex items-center gap-1.5">
                              {canManageJobs && m.status !== "shortlisted" && (
                                <Button
                                  size="sm"
                                  onClick={() => handleUpdateMatchStatus(activeJob.id, m.id, "shortlisted")}
                                  className="h-7 text-xs gap-1"
                                >
                                  <UserCheckIcon className="size-3" />
                                  Shortlist for Job
                                </Button>
                              )}

                              {canManageJobs && m.status !== "rejected" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleUpdateMatchStatus(activeJob.id, m.id, "rejected")}
                                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                                >
                                  Reject
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Job Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Create Job Opening</DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Job Title *</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Senior Full-Stack Engineer"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Minimum Experience (Years)</label>
              <Input
                type="number"
                value={newMinExp}
                onChange={(e) => setNewMinExp(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Required Skills (comma separated)</label>
              <Input
                value={newSkills}
                onChange={(e) => setNewSkills(e.target.value)}
                placeholder="e.g. React, TypeScript, Ruby on Rails, PostgreSQL"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Job Description & Responsibilities</label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={4}
                placeholder="Paste key responsibilities and qualifications..."
                className="w-full rounded-md border bg-background p-2 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-role-recruitment"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreateModalOpen(false)}
              disabled={createJob.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateJob}
              disabled={createJob.isPending || !newTitle.trim()}
            >
              {createJob.isPending ? "Creating..." : "Save Job Opening"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CandidateDetailModal
        candidateId={selectedCandidateId}
        open={!!selectedCandidateId}
        onOpenChange={(open) => !open && setSelectedCandidateId(null)}
      />
    </div>
  )
}

"use client"

import { useState } from "react"
import { useCandidates } from "../hooks"
import { CandidateDetailModal } from "./candidate-detail-modal"
import { InterviewActionsPanel } from "./interview-actions-panel"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  SearchIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  ClockIcon,
  MinusCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserCheckIcon,
  SlidersHorizontalIcon,
} from "lucide-react"
import { INTERVIEW_WORKFLOW_STATUSES, type CandidateStatus, type CandidateSummary } from "@/types/recruitment"
import { cn } from "cn"

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (`${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase()) || "?"
}

// Same hues as every other candidate-status badge in the app.
const STAGE_META: Record<string, { label: string; className: string }> = {
  interview_scheduled: { label: "Interview Scheduled", className: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30" },
  interview_completed: { label: "Interview Completed", className: "bg-teal-500/10 text-teal-600 border-teal-500/30" },
  feedback_received: { label: "Interview Completed", className: "bg-teal-500/10 text-teal-600 border-teal-500/30" },
  feedback_not_received: { label: "Interview Completed", className: "bg-teal-500/10 text-teal-600 border-teal-500/30" },
}

const STAGE_PILLS: { label: string; value: CandidateStatus | "" }[] = [
  { label: "All Interviews", value: "" },
  { label: "Scheduled", value: "interview_scheduled" },
  { label: "Completed", value: "interview_completed" },
  { label: "Feedback Received", value: "feedback_received" },
  { label: "Awaiting Feedback", value: "feedback_not_received" },
]

// Feedback is a separate axis from the interview itself: a candidate is only
// asked for feedback once the interview is done, and "not received" means the
// request went out and nothing has come back — not that nothing was asked.
function FeedbackCell({ status, submitted }: { status: CandidateStatus; submitted: boolean }) {
  if (status === "feedback_received" || submitted) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
        <CheckCircle2Icon className="size-3" />
        Received
      </span>
    )
  }
  if (status === "feedback_not_received") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[11px] font-medium text-orange-600">
        <ClockIcon className="size-3" />
        Not Received
      </span>
    )
  }
  // Scheduled / completed-but-not-yet-asked: no feedback request exists yet,
  // which is different from one that went out unanswered.
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <MinusCircleIcon className="size-3" />
      Not requested
    </span>
  )
}

/**
 * Candidates past the Shortlisted stage — everyone with an interview booked,
 * through to their feedback. Opened from the "Interview Scheduled" Quick Stat.
 * Rows open the same candidate profile modal the other candidate lists use.
 */
export function InterviewsView() {
  const [search, setSearch] = useState("")
  const [stage, setStage] = useState<CandidateStatus | "">("")
  const [page, setPage] = useState(1)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  // Status and Feedback are read-only badges; everything actionable lives
  // behind the Actions column, in one panel.
  const [actionsFor, setActionsFor] = useState<CandidateSummary | null>(null)

  const { data: response, isLoading } = useCandidates({
    // One stage when a pill is picked, otherwise the whole workflow — so a
    // candidate stays on this list as they move from scheduled to completed
    // to feedback, instead of disappearing at each step.
    status: stage || INTERVIEW_WORKFLOW_STATUSES,
    search: search.trim() || undefined,
    page,
  })

  const candidates = response?.data ?? []
  const meta = response?.meta

  return (
    <div className="space-y-4">
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
              placeholder="Search interviewing candidates by name, email or role..."
              className="pl-8 text-xs h-9"
            />
          </div>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b text-xs">
          {STAGE_PILLS.map((p) => {
            const isActive = stage === p.value
            const activeColor = p.value
              ? STAGE_META[p.value]?.className ?? "bg-primary/10 text-primary border-primary/30"
              : "bg-primary/10 text-primary border-primary/30"
            return (
              <button
                key={p.value}
                onClick={() => {
                  setStage(p.value)
                  setPage(1)
                }}
                className={cn(
                  "rounded-md border px-3 py-1.5 font-medium whitespace-nowrap transition-colors",
                  isActive ? activeColor : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-xs text-muted-foreground space-y-2">
          <CalendarClockIcon className="size-8 text-muted-foreground/40 mx-auto" />
          <p className="font-semibold text-foreground text-sm">No interviews here yet</p>
          <p className="max-w-md mx-auto text-muted-foreground">
            Open a shortlisted candidate&apos;s resume and use Schedule Interview — they&apos;ll appear here with their
            date, interviewer and feedback status.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border shadow-2xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Feedback</TableHead>
                <TableHead>Interview</TableHead>
                <TableHead>Interviewer</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((candidate) => {
                const stageMeta = STAGE_META[candidate.status]
                return (
                  <TableRow
                    key={candidate.id}
                    onClick={() => setSelectedCandidateId(candidate.id)}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar size="sm">
                          <AvatarFallback className="bg-role-recruitment/12 text-[11px] text-role-recruitment">
                            {initials(candidate.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground text-xs">{candidate.fullName}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {candidate.email || candidate.currentRole || "—"}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                          stageMeta?.className ?? "bg-muted text-muted-foreground"
                        )}
                      >
                        {candidate.status === "interview_scheduled" ? (
                          <CalendarClockIcon className="size-3" />
                        ) : (
                          <CheckCircle2Icon className="size-3" />
                        )}
                        {stageMeta?.label ?? candidate.status.replace(/_/g, " ")}
                      </span>
                    </TableCell>

                    <TableCell>
                      <FeedbackCell status={candidate.status} submitted={Boolean(candidate.feedbackSubmittedAt)} />
                    </TableCell>

                    <TableCell className="text-xs text-foreground">
                      {candidate.interviewAt
                        ? new Date(candidate.interviewAt).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "—"}
                    </TableCell>

                    <TableCell className="text-xs text-foreground">
                      {candidate.interviewerName ? (
                        <span className="inline-flex items-center gap-1.5">
                          <UserCheckIcon className="size-3.5 text-muted-foreground" />
                          {candidate.interviewerName}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>

                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setActionsFor(candidate)}
                          className="text-muted-foreground hover:text-role-recruitment"
                          title="Manage interview status and feedback"
                        >
                          <SlidersHorizontalIcon className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

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

      {/* One panel for everything actionable: stage, sending the form, and
          the response that came back. */}
      <InterviewActionsPanel
        candidate={actionsFor}
        open={!!actionsFor}
        onOpenChange={(open) => !open && setActionsFor(null)}
      />

      {/* Same profile modal the other candidate lists open. */}
      <CandidateDetailModal
        candidateId={selectedCandidateId}
        open={!!selectedCandidateId}
        onOpenChange={(open) => !open && setSelectedCandidateId(null)}
      />
    </div>
  )
}

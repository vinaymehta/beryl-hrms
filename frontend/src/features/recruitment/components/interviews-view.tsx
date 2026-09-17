"use client"

import { useState } from "react"
import { useCandidates } from "../hooks"
import { CandidateDetailModal } from "./candidate-detail-modal"
import { InterviewActionsPanel } from "./interview-actions-panel"
import { InterviewFeedbackDialog } from "./interview-feedback-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  SearchIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  SendIcon,
  MinusCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserCheckIcon,
  SlidersHorizontalIcon,
  FilterIcon,
  ChevronDownIcon,
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

// The two views worth a permanent tab: everyone in the workflow, and the
// people whose feedback has actually come back. Both are destinations you
// switch between constantly, so they stay one click away rather than behind
// the Filter.
const STAGE_TABS: { label: string; value: CandidateStatus | ""; activeClassName: string }[] = [
  { label: "All Interviews", value: "", activeClassName: "bg-primary/10 text-primary border-primary/30" },
  {
    label: "Feedback",
    value: "feedback_received",
    // Emerald, matching the "Received" badge in the Feedback column — not
    // STAGE_META's teal, whose label reads "Interview Completed" and would
    // say the wrong thing on a tab about feedback.
    activeClassName: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  },
]

// The narrower cuts — the two stages of the interview itself. Not tabs: you
// reach for these to answer a specific question, not to live in them. Link
// Sent is deliberately not offered; it's still a real status the Feedback
// column reports and the backend stores, just not something worth filtering
// the list down to.
const STAGE_FILTER_OPTIONS: { label: string; value: CandidateStatus }[] = [
  { label: "Scheduled", value: "interview_scheduled" },
  { label: "Completed", value: "interview_completed" },
]

// Only the Filter's own stages light it up — a tab selection is shown by the
// tab, not by a count on a control that didn't set it.
function isFilterStage(stage: CandidateStatus | "") {
  return STAGE_FILTER_OPTIONS.some((o) => o.value === stage)
}

// Feedback is a separate axis from the interview itself. Three distinct
// states, deliberately not collapsed: the form was never sent, the form was
// sent ("Link Sent"), or they answered. Labelling the middle one after what we
// did — sending the link — rather than what the candidate hasn't done avoids
// reading as though they ignored us when the request may have gone out minutes
// ago.
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
        <SendIcon className="size-3" />
        Link Sent
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
 * Under the Feedback Received tab a row opens what the interviewer submitted,
 * since that is the only reason to click someone there; everywhere else it
 * opens their candidate profile as before. The Actions column stays the way
 * to change the stage itself.
 */
export function InterviewsView() {
  const [search, setSearch] = useState("")
  const [stage, setStage] = useState<CandidateStatus | "">("")
  const [page, setPage] = useState(1)
  // Status and Feedback are read-only badges; everything actionable lives
  // behind the Actions column, in one panel.
  const [actionsFor, setActionsFor] = useState<CandidateSummary | null>(null)
  const [feedbackFor, setFeedbackFor] = useState<CandidateSummary | null>(null)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)

  // The Feedback Received tab is the one place a row means "show me the
  // feedback". On every other tab a row still opens the candidate profile.
  const showsFeedback = stage === "feedback_received"

  const { data: response, isLoading } = useCandidates({
    // One stage when the filter picks one, otherwise the whole workflow — so a
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
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
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

          {/* A real dropdown, not a popover wrapping a select: one click
              opens the stages, a second picks one. Only this list works this
              way — Resumes and Employees keep the FilterPopover, whose panels
              hold several controls at once and so genuinely need one. */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Filter interviews by stage"
                  className={cn(
                    "h-9 shrink-0 gap-1.5 rounded-full text-xs",
                    isFilterStage(stage) && "border-role-recruitment text-role-recruitment bg-role-recruitment/5"
                  )}
                />
              }
            >
              <FilterIcon className="size-3.5" />
              {/* The chosen stage names itself on the button, so no separate
                  count badge is needed to say something is filtered. */}
              {STAGE_FILTER_OPTIONS.find((o) => o.value === stage)?.label ?? "Filter"}
              <ChevronDownIcon className="size-3.5 opacity-60" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuRadioGroup
                // Bound to `stage` itself, not to a filter-only subset: on the
                // Feedback Received tab nothing here is checked, which is the
                // truth — that tab's stage is not one of these two.
                value={stage}
                onValueChange={(v) => {
                  setStage((v || "") as CandidateStatus | "")
                  setPage(1)
                }}
              >
                <DropdownMenuRadioItem value="" className="text-xs">
                  All
                </DropdownMenuRadioItem>
                {STAGE_FILTER_OPTIONS.map((o) => (
                  <DropdownMenuRadioItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b text-xs">
          {STAGE_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => {
                setStage(t.value)
                setPage(1)
              }}
              className={cn(
                "rounded-md border px-3 py-1.5 font-medium whitespace-nowrap transition-colors",
                stage === t.value
                  ? t.activeClassName
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {t.label}
            </button>
          ))}
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
                    onClick={() =>
                      showsFeedback ? setFeedbackFor(candidate) : setSelectedCandidateId(candidate.id)
                    }
                    className="cursor-pointer"
                    title={
                      showsFeedback
                        ? "Open the feedback the interviewer submitted"
                        : "Open this candidate's profile"
                    }
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

      {/* Feedback Received tab only — the interviewer's answers, not the
          candidate's resume. */}
      <InterviewFeedbackDialog
        candidate={feedbackFor}
        open={!!feedbackFor}
        onOpenChange={(open) => !open && setFeedbackFor(null)}
      />

      {/* Every other tab: the same profile modal the other candidate lists open. */}
      <CandidateDetailModal
        candidateId={selectedCandidateId}
        open={!!selectedCandidateId}
        onOpenChange={(open) => !open && setSelectedCandidateId(null)}
      />
    </div>
  )
}

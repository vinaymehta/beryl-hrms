"use client"

import { useState, type MouseEvent, type ReactNode } from "react"
import { toast } from "sonner"
import {
  CalendarCheckIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  FileTextIcon,
  RefreshCwIcon,
  SearchIcon,
  SendIcon,
  StarIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  UserCheckIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react"
import { recruitmentApi } from "../api"
import { useCandidateMutations, useInterviewStats, useInterviews, useJobs } from "../hooks"
import { InterviewFeedbackDetails } from "./interview-feedback"
import {
  CandidateProfileFacts,
  Fact,
  InterviewQuestionsSection,
  JoinLink,
  OverviewSection,
  StageBadge,
} from "./interview-overview"
import { DECISION_META, experienceLine, formatIst, relativeTime } from "../lib/interview-feedback"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DatePicker } from "@/components/ui/date-picker"
import { FilterPanel } from "@/components/ui/filter-panel"
import { Input } from "@/components/ui/input"
import { PanelSection } from "@/components/ui/panel"
import { SearchSelect } from "@/components/ui/search-select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDebounced } from "@/hooks/use-debounced"
import type { InterviewListParams, InterviewRow, InterviewTab, InterviewTabCounts } from "@/types/recruitment"
import { cn } from "cn"

const DAY_MS = 24 * 60 * 60 * 1000

const QUICK_TABS: { id: InterviewTab; label: string; count: keyof InterviewTabCounts }[] = [
  { id: "all", label: "All", count: "all" },
  { id: "today", label: "Today", count: "today" },
  { id: "upcoming", label: "Upcoming", count: "upcoming" },
  { id: "completed", label: "Completed", count: "completed" },
  { id: "awaiting_feedback", label: "Awaiting feedback", count: "awaitingFeedback" },
]

type FeedbackInfo = { label: string; date: string | null; className: string; overdue: boolean }

/** Where the write-up stands. Mirrors InterviewDashboard#overdue for the flag. */
function feedbackInfo(row: InterviewRow, now: number): FeedbackInfo | null {
  if (row.feedback.submittedAt) {
    return { label: "Received", date: row.feedback.submittedAt, className: "text-success", overdue: false }
  }
  if (!row.interviewerId) return null

  const interviewAt = row.interviewAt ? new Date(row.interviewAt).getTime() : null
  const requestedAt = row.feedbackRequestedAt ? new Date(row.feedbackRequestedAt).getTime() : null
  const awaiting = interviewAt == null || interviewAt <= now
  const overdue = awaiting && (requestedAt != null ? now - requestedAt > DAY_MS : interviewAt != null && now - interviewAt > DAY_MS)

  if (row.feedbackReminderSentAt) {
    return { label: "Reminder sent", date: row.feedbackReminderSentAt, className: "text-warning", overdue }
  }
  if (row.feedbackRequestedAt) {
    return { label: "Requested", date: row.feedbackRequestedAt, className: "text-foreground", overdue }
  }
  return { label: "Not requested", date: null, className: "text-muted-foreground", overdue }
}

function canRequestFeedback(row: InterviewRow) {
  return !row.feedback.submittedAt && !!row.interviewerId
}

function StatCard({
  label,
  value,
  icon: Icon,
  tint,
  loading,
  note,
}: {
  label: string
  value: string | number
  icon: LucideIcon
  tint: string
  loading: boolean
  note?: ReactNode
}) {
  return (
    <Card className="border shadow-2xs">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tint)}>
            <Icon className="size-4.5" />
          </span>
          <div className="text-2xl font-bold text-foreground">{loading ? <Skeleton className="h-7 w-10" /> : value}</div>
        </div>
        <p className="mt-2 truncate text-xs text-foreground/70">{label}</p>
        {note && !loading && <p className="mt-0.5 truncate text-[11px] font-medium text-warning">{note}</p>}
      </CardContent>
    </Card>
  )
}

function ResultCell({ row }: { row: InterviewRow }) {
  const decision = row.feedback.decision ? DECISION_META[row.feedback.decision] : null
  const rating = row.feedback.overallRating
  if (rating == null && !decision && row.feedback.wouldRecommend == null) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {rating != null && (
        <span className="inline-flex items-center gap-1 text-xs text-foreground">
          <StarIcon className="size-3.5 fill-warning text-warning" />
          {rating}/5
        </span>
      )}
      {decision ? (
        <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", decision.className)}>
          {decision.label}
        </span>
      ) : (
        row.feedback.wouldRecommend != null &&
        (row.feedback.wouldRecommend ? (
          <ThumbsUpIcon className="size-3.5 text-success" aria-label="Recommended" />
        ) : (
          <ThumbsDownIcon className="size-3.5 text-destructive" aria-label="Not recommended" />
        ))
      )}
    </span>
  )
}

function FeedbackCell({ info }: { info: FeedbackInfo | null }) {
  if (!info) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <div className="space-y-0.5">
      <p className={cn("text-xs font-medium whitespace-nowrap", info.className)}>
        {info.label}
        {info.date && <span className="font-normal text-muted-foreground"> {formatIst(info.date, "date")}</span>}
      </p>
      {info.overdue && <p className="text-[11px] font-medium text-warning">Overdue</p>}
    </div>
  )
}

function WhenCell({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-xs text-muted-foreground">Not booked</span>
  return (
    <div className="space-y-0.5">
      <p className="text-xs whitespace-nowrap text-foreground">{formatIst(iso)}</p>
      <p className="text-[11px] text-muted-foreground">{relativeTime(iso)}</p>
    </div>
  )
}

function RequestFeedbackButton({
  row,
  pending,
  onRequest,
  size = "sm",
}: {
  row: InterviewRow
  pending: boolean
  onRequest: (row: InterviewRow) => void
  size?: "sm" | "default"
}) {
  return (
    <Button
      size={size}
      variant="outline"
      className="gap-1.5"
      disabled={pending}
      onClick={(e: MouseEvent) => {
        // Inside a clickable row — the button must not also open the panel.
        e.stopPropagation()
        onRequest(row)
      }}
    >
      <SendIcon className="size-3.5" />
      {pending ? "Sending…" : row.feedbackRequestedAt ? "Send reminder" : "Request feedback"}
    </Button>
  )
}

/**
 * Everything about one interview: who the candidate is, when and with whom,
 * how the feedback chase has gone, and the write-up itself.
 */
function InterviewOverview({
  row,
  pending,
  onRequest,
}: {
  row: InterviewRow
  pending: boolean
  onRequest: (row: InterviewRow) => void
}) {
  const timeline = [
    { label: "Booking link sent", at: row.interviewLinkSentAt },
    { label: "Interview", at: row.interviewAt },
    { label: "Feedback requested", at: row.feedbackRequestedAt },
    { label: "Reminder sent", at: row.feedbackReminderSentAt },
    { label: "Feedback received", at: row.feedback.submittedAt },
  ].filter((step): step is { label: string; at: string } => !!step.at)

  return (
    <div className="space-y-6 px-4 pb-6">
      {(row.resumeId || row.joinUrl) && (
        <div className="flex flex-wrap gap-2">
          {row.resumeId && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              nativeButton={false}
              render={<a href={recruitmentApi.resumes.previewUrl(row.resumeId)} target="_blank" rel="noreferrer" />}
            >
              <FileTextIcon className="size-3.5" />
              Resume
            </Button>
          )}
          {row.joinUrl && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              nativeButton={false}
              render={<a href={row.joinUrl} target="_blank" rel="noreferrer" />}
            >
              <VideoIcon className="size-3.5" />
              Join
            </Button>
          )}
        </div>
      )}

      <OverviewSection title="Candidate">
        <CandidateProfileFacts profile={row.profile}>
          <Fact label="Email">
            {row.candidateEmail ? (
              <a href={`mailto:${row.candidateEmail}`} className="text-primary hover:underline">
                {row.candidateEmail}
              </a>
            ) : null}
          </Fact>
          <Fact label="Phone">{row.candidatePhone}</Fact>
          <Fact label="ATS score">{row.atsScore != null ? `${row.atsScore}/100` : null}</Fact>
          <Fact label="Match">{row.matchPercentage != null ? `${row.matchPercentage}%` : null}</Fact>
        </CandidateProfileFacts>
      </OverviewSection>

      <OverviewSection title="Interview">
        <dl className="space-y-1.5">
          <Fact label="Applied for">{row.jobTitle || "—"}</Fact>
          <Fact label="When">
            {row.interviewAt ? `${formatIst(row.interviewAt)} IST · ${relativeTime(row.interviewAt)}` : "Not booked yet"}
          </Fact>
          <Fact label="Interviewer">
            {row.interviewerName ?? <span className="text-warning">No interviewer assigned</span>}
          </Fact>
          <Fact label="Join link">{row.joinUrl ? <JoinLink url={row.joinUrl} /> : null}</Fact>
        </dl>
        {timeline.length > 0 && (
          <ol className="mt-1 space-y-0 border-l pl-4">
            {timeline.map((step) => (
              <li key={step.label} className="relative pb-2.5 last:pb-0">
                <span className="absolute top-1 -left-[1.3rem] size-2 rounded-full bg-role-recruitment" />
                <p className="text-xs text-foreground">{step.label}</p>
                <p className="text-[11px] text-muted-foreground">{formatIst(step.at)} IST</p>
              </li>
            ))}
          </ol>
        )}
      </OverviewSection>

      <InterviewQuestionsSection questions={row.interviewQuestions} />

      <OverviewSection title="Feedback">
        {row.feedback.submittedAt ? (
          <InterviewFeedbackDetails feedback={row.feedback} />
        ) : (
          <div className="space-y-3 rounded-lg border border-dashed p-4 text-center">
            <ClockIcon className="mx-auto size-6 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              {!row.interviewerId
                ? "Assign an interviewer before asking for feedback."
                : row.feedbackRequestedAt
                  ? `Requested ${formatIst(row.feedbackRequestedAt)} IST${
                      row.feedbackReminderSentAt ? `, reminded ${formatIst(row.feedbackReminderSentAt)} IST` : ""
                    } — nothing back yet.`
                  : row.interviewStage === "completed"
                    ? "No feedback request has gone out yet."
                    : "The request goes to the interviewer automatically an hour after the interview."}
            </p>
            {canRequestFeedback(row) && <RequestFeedbackButton row={row} pending={pending} onRequest={onRequest} />}
          </div>
        )}
      </OverviewSection>
    </div>
  )
}

/**
 * Every interview in the company and its whole story — when, with whom, where
 * the feedback chase stands and what was decided. One interview per
 * candidate, so a row is a candidate; clicking one opens the full overview.
 */
export function InterviewsDashboard({ tabs }: { tabs?: ReactNode }) {
  const [filters, setFilters] = useState<InterviewListParams>({})
  const [tab, setTab] = useState<InterviewTab>("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [requestingId, setRequestingId] = useState<string | null>(null)
  const q = useDebounced(search.trim(), 300)

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useInterviewStats()
  const { data: response, isLoading, refetch, dataUpdatedAt } = useInterviews({ ...filters, tab, q: q || undefined, page })
  const { data: jobs } = useJobs()
  const { requestFeedback } = useCandidateMutations()

  const rows = response?.data ?? []
  const meta = response?.meta
  // Read off the list so the panel picks up a refetch (e.g. after a request).
  const selected = rows.find((r) => r.id === selectedId) ?? null
  // "Overdue" is judged as of the fetch — the render itself has to stay pure.
  const now = dataUpdatedAt

  const setFilter = <K extends keyof InterviewListParams>(key: K, value: InterviewListParams[K]) => {
    setFilters((f) => ({ ...f, [key]: value || undefined }))
    setPage(1)
  }
  const activeCount = (["interviewerId", "jobId", "from", "to"] as const).filter((k) => filters[k]).length
  const searching = activeCount > 0 || !!q

  const handleRequest = async (row: InterviewRow) => {
    setRequestingId(row.id)
    try {
      await requestFeedback.mutateAsync(row.id)
      toast.success(row.feedbackRequestedAt ? "Reminder sent" : "Feedback requested", {
        description: `${row.interviewerName ?? "The interviewer"} has been emailed about ${row.candidateName}.`,
      })
      refetchStats()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send the feedback request")
    } finally {
      setRequestingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-role-recruitment/12 text-role-recruitment">
              <CalendarClockIcon className="size-7" />
            </span>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Interviews</h2>
              <p className="text-sm text-muted-foreground">Every interview, from booking to the hiring call</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="gap-1.5 self-start sm:self-auto"
            onClick={() => {
              refetchStats()
              refetch()
            }}
          >
            <RefreshCwIcon className="size-4" />
            Refresh
          </Button>
        </div>
        {tabs}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="This week" value={stats?.thisWeek ?? 0} icon={CalendarDaysIcon} tint="bg-role-recruitment text-role-recruitment-foreground" loading={statsLoading} />
        <StatCard label="Completed" value={stats?.completed ?? 0} icon={CalendarCheckIcon} tint="bg-primary text-primary-foreground" loading={statsLoading} />
        <StatCard
          label="Awaiting feedback"
          value={stats?.awaitingFeedback ?? 0}
          icon={ClockIcon}
          tint="bg-warning text-warning-foreground"
          loading={statsLoading}
          note={stats?.overdueFeedback ? `${stats.overdueFeedback} overdue` : undefined}
        />
        <StatCard label="Hired" value={stats?.hired ?? 0} icon={CheckCircle2Icon} tint="bg-success text-success-foreground" loading={statsLoading} />
        <StatCard
          label="Avg rating"
          value={stats?.avgRating != null ? `${stats.avgRating}/5` : "—"}
          icon={StarIcon}
          tint="bg-muted text-foreground"
          loading={statsLoading}
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div role="tablist" aria-label="Show" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
            {QUICK_TABS.map((option) => {
              const count = meta?.counts[option.count]
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === option.id}
                  onClick={() => {
                    setTab(option.id)
                    setPage(1)
                  }}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs whitespace-nowrap transition-colors",
                    tab === option.id
                      ? "border-role-recruitment bg-role-recruitment/10 font-medium text-role-recruitment"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  {option.label}
                  {count != null && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-[10px] tabular-nums",
                        tab === option.id ? "bg-role-recruitment text-role-recruitment-foreground" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1 lg:w-64 lg:flex-none">
              <SearchIcon className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Search name, email or role…"
                aria-label="Search interviews"
                className="pl-8"
              />
            </div>
            <FilterPanel
              activeCount={activeCount}
              onReset={() => {
                setFilters({})
                setPage(1)
              }}
              ariaLabel="Filter interviews"
              title="Filter interviews"
              accentClassName="border-role-recruitment text-role-recruitment bg-role-recruitment/5"
              badgeClassName="bg-role-recruitment text-role-recruitment-foreground"
            >
              <PanelSection title="Interviewer" flush>
                <SearchSelect
                  aria-label="Interviewer"
                  options={(stats?.interviewers ?? []).map((i) => ({ value: i.id, label: i.name ?? "Unknown" }))}
                  value={filters.interviewerId ?? null}
                  onChange={(v) => setFilter("interviewerId", v ?? undefined)}
                  placeholder="All interviewers"
                  clearable
                />
              </PanelSection>
              <PanelSection title="Job">
                <SearchSelect
                  aria-label="Job"
                  options={(jobs ?? []).map((j) => ({ value: j.id, label: j.title }))}
                  value={filters.jobId ?? null}
                  onChange={(v) => setFilter("jobId", v ?? undefined)}
                  placeholder="All jobs"
                  clearable
                />
              </PanelSection>
              <PanelSection title="Interview date (IST)">
                <DatePicker value={filters.from ?? ""} onChange={(v) => setFilter("from", v)} max={filters.to} placeholder="From" clearable />
                <DatePicker value={filters.to ?? ""} onChange={(v) => setFilter("to", v)} min={filters.from} placeholder="To" clearable />
              </PanelSection>
            </FilterPanel>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="space-y-2 rounded-xl border border-dashed p-12 text-center text-xs text-muted-foreground">
            <CalendarClockIcon className="mx-auto size-8 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-foreground">No interviews match</p>
            <p>
              {searching
                ? "Try a different search or clear some filters."
                : tab === "all"
                  ? "Interviews appear here once a candidate books a slot."
                  : "Nothing here right now."}
            </p>
          </div>
        ) : (
          <>
            {/* Phones get cards; the table needs the width. */}
            <div className="space-y-2 md:hidden">
              {rows.map((row) => (
                <div
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(row.id)}
                  onKeyDown={(e) => e.key === "Enter" && setSelectedId(row.id)}
                  className="space-y-2.5 rounded-xl border bg-card p-3.5 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{row.candidateName}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.jobTitle || "—"}</p>
                    </div>
                    <StageBadge stage={row.interviewStage} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <span className="truncate text-muted-foreground">
                      {row.interviewerName ?? <span className="text-warning">No interviewer</span>}
                    </span>
                    <span className="truncate text-right text-muted-foreground">
                      {row.interviewAt ? relativeTime(row.interviewAt) : "Not booked"}
                    </span>
                    <FeedbackCell info={feedbackInfo(row, now)} />
                    <span className="text-right">
                      <ResultCell row={row} />
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-hidden rounded-xl border shadow-2xs md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Applied for</TableHead>
                    <TableHead>Interviewer</TableHead>
                    <TableHead>When (IST)</TableHead>
                    <TableHead>Interview</TableHead>
                    <TableHead>Feedback</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} onClick={() => setSelectedId(row.id)} className="cursor-pointer" title="Open the interview">
                      <TableCell className="max-w-56">
                        <p className="truncate text-xs font-medium text-foreground">{row.candidateName}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{experienceLine(row.profile)}</p>
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-xs text-foreground">{row.jobTitle || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {row.interviewerName ? (
                          <span className="text-foreground">{row.interviewerName}</span>
                        ) : (
                          <span className="text-warning">No interviewer</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <WhenCell iso={row.interviewAt} />
                      </TableCell>
                      <TableCell>
                        <StageBadge stage={row.interviewStage} />
                      </TableCell>
                      <TableCell>
                        <FeedbackCell info={feedbackInfo(row, now)} />
                      </TableCell>
                      <TableCell>
                        <ResultCell row={row} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
            <span>
              Page {meta.page} of {meta.totalPages} ({meta.totalCount} interviews)
            </span>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page <= 1} className="h-8 gap-1 text-xs">
                <ChevronLeftIcon className="size-3.5" /> Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.min(p + 1, meta.totalPages))}
                disabled={page >= meta.totalPages}
                className="h-8 gap-1 text-xs"
              >
                Next <ChevronRightIcon className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader className="space-y-1 border-b pr-12">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle>{selected.candidateName}</SheetTitle>
                  <StageBadge stage={selected.interviewStage} />
                </div>
                <SheetDescription>
                  {selected.jobTitle ? `Applied for ${selected.jobTitle}` : "No role recorded"}
                </SheetDescription>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClockIcon className="size-3.5" />
                    {selected.interviewAt ? `${formatIst(selected.interviewAt)} IST` : "Not booked"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <UserCheckIcon className="size-3.5" />
                    {selected.interviewerName || "No interviewer"}
                  </span>
                </div>
              </SheetHeader>
              <div className="pt-4">
                <InterviewOverview row={selected} pending={requestingId === selected.id} onRequest={handleRequest} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

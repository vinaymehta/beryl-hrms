"use client"

import { useRouter } from "next/navigation"
import {
  useRecruitmentAnalytics,
  useRecruitmentInsights,
  useCandidates,
  useResumes,
} from "../hooks"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "cn"
import {
  UsersIcon,
  FileTextIcon,
  SparklesIcon,
  ArrowUpRightIcon,
  ArrowRightIcon,
  BriefcaseIcon,
  GraduationCapIcon,
  MapPinIcon,
  AwardIcon,
  XIcon,
  CheckCircle2Icon,
  ClockIcon,
  XCircleIcon,
  CopyIcon,
  Loader2Icon,
  AlertCircleIcon,
  type LucideIcon,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts"
import type { CandidateStatus, RecruitmentTab } from "@/types/recruitment"

export type DashboardDetail =
  | { type: "candidates"; status: CandidateStatus | ""; label: string }
  | { type: "resumes"; status: string; label: string }

interface DashboardViewProps {
  onNavigateTab: (tab: RecruitmentTab, filter?: string) => void
  detail: DashboardDetail | null
  onOpenDetail: (detail: DashboardDetail) => void
  onCloseDetail: () => void
}

// One semantic color per candidate status, reused consistently everywhere
// this status appears in the app (candidates-view.tsx, candidate profile).
const STATUS_BADGE: Record<string, string> = {
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

const STATUS_BAR: Record<string, string> = {
  needs_review: "bg-amber-500",
  applied: "bg-blue-500",
  screening: "bg-purple-500",
  interviewing: "bg-indigo-500",
  shortlisted: "bg-role-recruitment",
  offered: "bg-emerald-500",
  rejected: "bg-muted-foreground/40",
  interview_scheduled: "bg-cyan-500",
  interview_completed: "bg-teal-500",
  feedback_received: "bg-emerald-500",
  feedback_not_received: "bg-orange-500",
}

// Funnel order for the pipeline view — unrecognized statuses (shouldn't occur,
// but real data always wins over a hardcoded list) sort after known ones.
const PIPELINE_ORDER = [
  "needs_review",
  "applied",
  "screening",
  "interviewing",
  "shortlisted",
  // Interview workflow sits after Shortlisted, in the order a candidate
  // actually moves through it.
  "interview_scheduled",
  "interview_completed",
  "feedback_received",
  "feedback_not_received",
  "offered",
  "rejected",
]

// Aggregation endpoints can surface a null/blank status when a row's raw DB
// value falls outside the enum's mapped range (e.g. stale/corrupt data) —
// keep that from crashing the dashboard.
function humanizeStatus(status: string | null | undefined): string {
  if (!status) return "Unknown"
  return status.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/_/g, " ")
}

// Matches the same resume processing-status colors/labels used in resumes-view.tsx.
const RESUME_STATUS_BADGE: Record<string, string> = {
  pending: "bg-blue-500/10 text-blue-600",
  processing: "bg-cyan-500/10 text-cyan-600",
  completed: "bg-emerald-500/10 text-emerald-600",
  failed: "bg-red-500/10 text-red-600",
  not_a_resume: "bg-muted text-muted-foreground",
  duplicate: "bg-violet-500/10 text-violet-600",
}

const RESUME_STATUS_ICON_TINT: Record<string, string> = {
  pending: "bg-blue-500 text-white",
  processing: "bg-cyan-500 text-white",
  completed: "bg-emerald-500 text-white",
  failed: "bg-red-500 text-white",
  not_a_resume: "bg-muted-foreground text-white",
  duplicate: "bg-violet-500 text-white",
}

const RESUME_STATUS_ICON: Record<string, LucideIcon> = {
  pending: ClockIcon,
  processing: Loader2Icon,
  completed: CheckCircle2Icon,
  failed: AlertCircleIcon,
  not_a_resume: XCircleIcon,
  duplicate: CopyIcon,
}

const RESUME_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Needs Retry / Failed",
  not_a_resume: "Not a Resume",
  duplicate: "Duplicate",
}

const RESUME_STATUS_ORDER = ["completed", "processing", "pending", "failed", "not_a_resume", "duplicate"]

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (`${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase()) || "?"
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return ""
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function sortByOrder<T extends { status: string }>(items: T[], order: string[]): T[] {
  return [...items].sort((a, b) => {
    const ai = order.indexOf(a.status)
    const bi = order.indexOf(b.status)
    return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi)
  })
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</h3>
}

function EmptyChart({ label, compact }: { label: string; compact?: boolean }) {
  return (
    <div className={`flex items-center justify-center text-center text-xs text-muted-foreground ${compact ? "h-16" : "h-36"}`}>
      <p>{label}</p>
    </div>
  )
}

/** Recharts passes each hovered series entry in `payload`; only the datum it
 *  wraps is read here, so that is all this types. */
interface ChartTooltipEntry {
  payload: Record<string, string | number | null | undefined>
}

function ChartTooltip({
  active,
  payload,
  nameKey,
  unit,
}: {
  active?: boolean
  payload?: ChartTooltipEntry[]
  nameKey: string
  unit: string
}) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm">
      <p className="font-semibold">{item[nameKey]}</p>
      <p className="text-muted-foreground">{item.count} {unit}</p>
    </div>
  )
}

function HorizontalBarList({ items }: { items: { name: string; count: number }[] }) {
  const max = Math.max(...items.map((i) => i.count), 1)
  return (
    <div className="space-y-2.5">
      {items.map((item, idx) => (
        <div key={item.name} className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="truncate font-medium text-foreground" title={item.name}>
              {item.name}
            </span>
            <span className="shrink-0 font-semibold text-muted-foreground">{item.count}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${(item.count / max) * 100}%`, backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// Detail panel shown at the top of the dashboard when a KPI card or a
// pipeline/processing stage is clicked — real, filtered data, inline,
// without navigating away from the Dashboard tab.
function DetailPanel({ detail, onNavigateTab, onClose }: {
  detail: DashboardDetail
  onNavigateTab: (tab: RecruitmentTab, filter?: string) => void
  onClose: () => void
}) {
  const candidatesQuery = useCandidates({
    status: detail.type === "candidates" ? detail.status : "",
    page: 1,
    enabled: detail.type === "candidates",
  })
  const resumesQuery = useResumes({
    status: detail.type === "resumes" ? detail.status || undefined : undefined,
    page: 1,
    enabled: detail.type === "resumes",
  })

  const isLoading = detail.type === "candidates" ? candidatesQuery.isLoading : resumesQuery.isLoading
  const candidateRows = detail.type === "candidates" ? (candidatesQuery.data?.data ?? []).slice(0, 6) : []
  const resumeRows = detail.type === "resumes" ? (resumesQuery.data?.data ?? []).slice(0, 6) : []

  return (
    <Card className="border-l-4 border-l-role-recruitment shadow-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">{detail.label}</CardTitle>
        <Button size="icon-sm" variant="ghost" onClick={onClose} className="text-muted-foreground">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-1">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : detail.type === "candidates" ? (
          candidateRows.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No candidates yet.</p>
          ) : (
            <div className="divide-y">
              {candidateRows.map((c) => (
                <div key={c.id} className="flex items-center gap-2.5 py-2">
                  <Avatar size="sm">
                    <AvatarFallback className="bg-role-recruitment/12 text-[11px] text-role-recruitment">
                      {initials(c.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">{c.fullName}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {c.city || "—"} · {c.experienceYears ? `${c.experienceYears} yrs` : "—"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${STATUS_BADGE[c.status] || "bg-muted text-muted-foreground"}`}
                  >
                    {humanizeStatus(c.status)}
                  </span>
                </div>
              ))}
            </div>
          )
        ) : resumeRows.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">No resumes to process.</p>
        ) : (
          <div className="divide-y">
            {resumeRows.map((r) => (
              <div key={r.id} className="flex items-center gap-2.5 py-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <FileTextIcon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">{r.fileName}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {r.candidateName || "Unlinked"} · {formatDate(r.createdAt)}
                    {r.fileSize ? ` · ${formatBytes(r.fileSize)}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${RESUME_STATUS_BADGE[r.processingStatus] || "bg-muted text-muted-foreground"}`}
                >
                  {RESUME_STATUS_LABEL[r.processingStatus] || humanizeStatus(r.processingStatus)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 flex justify-end border-t pt-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              onNavigateTab(detail.type === "candidates" ? "candidates" : "resumes", detail.status)
            }
            className="text-xs gap-1 text-muted-foreground hover:text-foreground"
          >
            View all in {detail.type === "candidates" ? "Candidates" : "Resumes & Ingestion"}{" "}
            <ArrowUpRightIcon className="size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardView({ onNavigateTab, detail, onOpenDetail, onCloseDetail }: DashboardViewProps) {
  const router = useRouter()
  const { data: analytics, isLoading: analyticsLoading } = useRecruitmentAnalytics()
  const { data: insights, isLoading: insightsLoading } = useRecruitmentInsights()
  const { data: recentResponse, isLoading: recentLoading } = useCandidates({ page: 1 })

  const recentCandidates = (recentResponse?.data ?? []).slice(0, 5)
  const hasInsights = Boolean(insights?.summary || (insights?.insights && insights.insights.length > 0))

  const pipeline = analytics?.candidatePipeline ? sortByOrder(analytics.candidatePipeline, PIPELINE_ORDER) : []
  const processing = analytics?.resumeProcessingStatus ? sortByOrder(analytics.resumeProcessingStatus, RESUME_STATUS_ORDER) : []

  return (
    <div className="space-y-6">
      {detail && (
        <DetailPanel detail={detail} onNavigateTab={onNavigateTab} onClose={onCloseDetail} />
      )}

      {/* AI Insights */}
      <Card className="shadow-2xs">
        <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
          <div className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-role-recruitment" />
            <CardTitle className="text-sm font-semibold">AI Insights</CardTitle>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onNavigateTab("search")}
            className="text-xs text-role-recruitment hover:text-role-recruitment gap-1"
          >
            Open AI Search <ArrowUpRightIcon className="size-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="p-4 pt-1">
          {insightsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3.5 w-1/2" />
            </div>
          ) : hasInsights ? (
            <ul className="space-y-1.5">
              {insights?.summary && <li className="text-xs leading-relaxed text-foreground">{insights.summary}</li>}
              {insights?.insights?.map((card, i) => (
                <li key={i} className="flex gap-1.5 text-xs leading-relaxed text-muted-foreground">
                  <span className="text-role-recruitment">•</span>
                  <span>
                    <span className="font-medium text-foreground">{card.title}.</span> {card.detail}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No insights available yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Candidate Overview */}
      <div className="space-y-3">
        <SectionLabel>Candidate Overview</SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="shadow-2xs">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center gap-2">
                <MapPinIcon className="size-4 text-muted-foreground" />
                <CardTitle className="text-sm font-semibold">Candidates by Location</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {analyticsLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : analytics?.candidatesByCity && analytics.candidatesByCity.length > 0 ? (
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={analytics.candidatesByCity} margin={{ top: 20, left: 0, right: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} className="text-[10px] fill-muted-foreground" />
                    <YAxis hide allowDecimals={false} />
                    <Tooltip content={<ChartTooltip nameKey="name" unit="Candidates" />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--chart-1)" maxBarSize={36}>
                      <LabelList dataKey="count" position="top" className="fill-foreground text-xs font-semibold" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="No location data available" />
              )}
            </CardContent>
          </Card>

          <Card className="shadow-2xs">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center gap-2">
                <BriefcaseIcon className="size-4 text-muted-foreground" />
                <CardTitle className="text-sm font-semibold">Experience Distribution</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {analyticsLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : analytics?.experienceDistribution && analytics.experienceDistribution.some((e) => e.count > 0) ? (
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={analytics.experienceDistribution}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                    <XAxis dataKey="bracket" tickLine={false} axisLine={false} className="text-[10px] fill-muted-foreground" />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} className="text-[10px] fill-muted-foreground" width={28} />
                    <Tooltip content={<ChartTooltip nameKey="bracket" unit="Candidates" />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--chart-2)" maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="No experience data available" />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Talent Insights */}
      <div className="space-y-3">
        <SectionLabel>Talent Insights</SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="shadow-2xs">
            <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
              <div className="flex items-center gap-2">
                <AwardIcon className="size-4 text-muted-foreground" />
                <CardTitle className="text-sm font-semibold">Top Skills</CardTitle>
              </div>
              {analytics?.topSkills && analytics.topSkills.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => onNavigateTab("search")} className="text-xs text-muted-foreground hover:text-foreground">
                  View All
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {analyticsLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : analytics?.topSkills && analytics.topSkills.length > 0 ? (
                <HorizontalBarList items={analytics.topSkills.slice(0, 6)} />
              ) : (
                <EmptyChart label="No skills data available" compact />
              )}
            </CardContent>
          </Card>

          <Card className="shadow-2xs">
            <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
              <div className="flex items-center gap-2">
                <GraduationCapIcon className="size-4 text-muted-foreground" />
                <CardTitle className="text-sm font-semibold">Qualification Distribution</CardTitle>
              </div>
              {analytics?.candidatesByQualification && analytics.candidatesByQualification.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => onNavigateTab("search")} className="text-xs text-muted-foreground hover:text-foreground">
                  View All
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {analyticsLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : analytics?.candidatesByQualification && analytics.candidatesByQualification.length > 0 ? (
                <HorizontalBarList items={analytics.candidatesByQualification.slice(0, 6)} />
              ) : (
                <EmptyChart label="No qualification data available" compact />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Candidate Pipeline / Resume Processing */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2 flex flex-col">
          <SectionLabel>Candidate Pipeline</SectionLabel>
          <Card className="shadow-2xs flex-1">
            <CardContent className="p-4">
              {analyticsLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : pipeline.some((p) => p.count > 0) ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {pipeline.map((p, idx) => {
                    const label = humanizeStatus(p.status)
                    return (
                      <div key={p.status ?? `unknown-${idx}`} className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onOpenDetail({ type: "candidates", status: (p.status ?? "") as CandidateStatus, label: `${label} Candidates` })
                          }
                          className={cn(
                            "flex min-w-28 flex-col gap-0.5 rounded-lg px-3.5 py-2.5 text-left transition-transform cursor-pointer hover:-translate-y-0.5",
                            (p.status && STATUS_BADGE[p.status]) || "bg-muted text-muted-foreground"
                          )}
                        >
                          <span className="text-lg font-bold">{p.count}</span>
                          <span className="text-[11px] font-medium whitespace-nowrap">{label}</span>
                        </button>
                        {idx < pipeline.length - 1 && (
                          <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground/50" />
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyChart label="No pipeline data available" compact />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3 flex flex-col">
          <SectionLabel>Resume Processing</SectionLabel>
          <Card className="shadow-2xs flex-1">
            <CardContent className="p-4">
              {analyticsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : processing.some((s) => s.count > 0) ? (
                <div className="space-y-1.5">
                  {processing.map((s) => {
                    const Icon = RESUME_STATUS_ICON[s.status] || FileTextIcon
                    return (
                      <button
                        key={s.status}
                        type="button"
                        onClick={() =>
                          onOpenDetail({
                            type: "resumes",
                            status: s.status,
                            label: `${RESUME_STATUS_LABEL[s.status] || s.status} Resumes`,
                          })
                        }
                        className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted/50 cursor-pointer"
                      >
                        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", RESUME_STATUS_ICON_TINT[s.status] || "bg-muted-foreground text-white")}>
                          <Icon className="size-4" />
                        </span>
                        <span className="flex-1 truncate text-sm font-medium text-foreground">
                          {RESUME_STATUS_LABEL[s.status] || humanizeStatus(s.status)}
                        </span>
                        <span className="text-lg font-bold text-foreground">{s.count}</span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <EmptyChart label="No processing data available" compact />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Candidates */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionLabel>Recent Candidates</SectionLabel>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onNavigateTab("candidates")}
            className="text-xs gap-1 text-muted-foreground hover:text-foreground"
          >
            View all <ArrowUpRightIcon className="size-3.5" />
          </Button>
        </div>
        <Card className="shadow-2xs overflow-hidden">
          {recentLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : recentCandidates.length === 0 ? (
            <p className="p-6 text-center text-xs text-muted-foreground">No candidates yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCandidates.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/recruitment/candidates/${c.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar size="sm">
                          <AvatarFallback className="bg-role-recruitment/12 text-[11px] text-role-recruitment">
                            {initials(c.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{c.fullName}</p>
                          <p className="truncate text-xs text-muted-foreground">{c.currentRole || "—"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_BADGE[c.status] || "bg-muted text-muted-foreground"}`}
                      >
                        {humanizeStatus(c.status)}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.city || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.experienceYears ? `${c.experienceYears} yrs` : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  )
}

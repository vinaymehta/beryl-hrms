"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  useRecruitmentStats,
  useRecruitmentAnalytics,
  useRecruitmentInsights,
  useCandidates,
} from "../hooks"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  UsersIcon,
  FileTextIcon,
  AlertCircleIcon,
  StarIcon,
  Loader2Icon,
  SparklesIcon,
  RefreshCwIcon,
  MailSearchIcon,
  ArrowUpRightIcon,
  BriefcaseIcon,
  GraduationCapIcon,
  MapPinIcon,
  AwardIcon,
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
} from "recharts"
import { ScanZohoModal } from "./scan-zoho-modal"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@/constants/permissions"

interface DashboardViewProps {
  onNavigateTab: (tab: string) => void
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
}

const STATUS_BAR: Record<string, string> = {
  needs_review: "bg-amber-500",
  applied: "bg-blue-500",
  screening: "bg-purple-500",
  interviewing: "bg-indigo-500",
  shortlisted: "bg-role-recruitment",
  offered: "bg-emerald-500",
  rejected: "bg-muted-foreground/40",
}

// Matches the same resume processing-status colors used in resumes-view.tsx.
const RESUME_STATUS_BADGE: Record<string, string> = {
  pending: "bg-blue-500/10 text-blue-600",
  processing: "bg-cyan-500/10 text-cyan-600",
  completed: "bg-emerald-500/10 text-emerald-600",
  failed: "bg-red-500/10 text-red-600",
  not_a_resume: "bg-muted text-muted-foreground",
  duplicate: "bg-violet-500/10 text-violet-600",
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (`${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase()) || "?"
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
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

function ChartTooltip({ active, payload, nameKey, unit }: { active?: boolean; payload?: any[]; nameKey: string; unit: string }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm">
      <p className="font-semibold">{item[nameKey]}</p>
      <p className="text-muted-foreground">{item.count} {unit}</p>
    </div>
  )
}

interface Kpi {
  key: string
  label: string
  value: number | undefined
  caption?: string
  icon: LucideIcon
  tint: string
  hero?: boolean
  onClick: () => void
}

export function DashboardView({ onNavigateTab }: DashboardViewProps) {
  const router = useRouter()
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useRecruitmentStats()
  const { data: analytics, isLoading: analyticsLoading } = useRecruitmentAnalytics()
  const { data: insights, isLoading: insightsLoading, refetch: refetchInsights } = useRecruitmentInsights()
  const { data: recentResponse, isLoading: recentLoading } = useCandidates({ page: 1 })
  const canProcess = usePermission([PERMISSIONS.recruitmentManage, PERMISSIONS.resumesProcess])

  const [scanModalOpen, setScanModalOpen] = useState(false)

  const processingResumes = analytics?.resumeProcessingStatus?.find((s) => s.status === "processing")?.count ?? 0
  const recentCandidates = (recentResponse?.data ?? []).slice(0, 5)
  const hasInsights = Boolean(insights?.summary || (insights?.insights && insights.insights.length > 0))

  const kpis: Kpi[] = [
    {
      key: "total",
      label: "Total Candidates",
      value: stats?.totalCandidates,
      icon: UsersIcon,
      tint: "bg-role-recruitment/12 text-role-recruitment",
      hero: true,
      onClick: () => onNavigateTab("candidates"),
    },
    {
      key: "new",
      label: "New Resumes",
      value: stats?.newResumes,
      caption: "Last 7 days",
      icon: FileTextIcon,
      tint: "bg-blue-500/12 text-blue-600",
      onClick: () => onNavigateTab("resumes"),
    },
    {
      key: "review",
      label: "Needs Review",
      value: stats?.needsReviewCandidates,
      icon: AlertCircleIcon,
      tint: "bg-amber-500/12 text-amber-600",
      onClick: () => onNavigateTab("candidates"),
    },
    {
      key: "shortlisted",
      label: "Shortlisted",
      value: stats?.shortlistedCandidates,
      icon: StarIcon,
      tint: "bg-role-recruitment/12 text-role-recruitment",
      onClick: () => onNavigateTab("candidates"),
    },
    {
      key: "processing",
      label: "Processing",
      value: processingResumes,
      icon: Loader2Icon,
      tint: "bg-cyan-500/12 text-cyan-600",
      onClick: () => onNavigateTab("resumes"),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Recruitment</h2>
          <p className="text-sm text-muted-foreground">Candidate intelligence and hiring overview</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              refetchStats()
              refetchInsights()
            }}
            className="text-xs gap-1.5"
          >
            <RefreshCwIcon className="size-3.5" />
            Refresh
          </Button>

          {canProcess && (
            <Button
              size="sm"
              onClick={() => setScanModalOpen(true)}
              className="text-xs gap-1.5 shadow-sm"
            >
              <MailSearchIcon className="size-3.5" />
              Scan Zoho Mail
            </Button>
          )}

          {canProcess && (
            <Button size="sm" variant="outline" onClick={() => onNavigateTab("resumes")} className="text-xs gap-1.5">
              <FileTextIcon className="size-3.5" />
              Upload Resume
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((kpi) => (
          <Card
            key={kpi.key}
            onClick={kpi.onClick}
            className="cursor-pointer shadow-2xs transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <CardContent className="flex items-center justify-between gap-2 p-4">
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">{kpi.label}</p>
                <div className={kpi.hero ? "text-3xl font-semibold text-foreground" : "text-2xl font-semibold text-foreground"}>
                  {statsLoading ? <Skeleton className="h-7 w-10" /> : (kpi.value ?? 0)}
                </div>
                {kpi.caption && <p className="mt-0.5 text-[11px] text-muted-foreground">{kpi.caption}</p>}
              </div>
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${kpi.tint}`}>
                <kpi.icon className="size-4.5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

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
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={analytics.candidatesByCity} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                    <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} className="text-[10px] fill-muted-foreground" />
                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} className="text-[10px] fill-foreground font-medium" width={70} />
                    <Tooltip content={<ChartTooltip nameKey="name" unit="Candidates" />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="var(--chart-1)" maxBarSize={18} />
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
              ) : analytics?.experienceDistribution && analytics.experienceDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
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
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center gap-2">
                <AwardIcon className="size-4 text-muted-foreground" />
                <CardTitle className="text-sm font-semibold">Top Skills</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {analyticsLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : analytics?.topSkills && analytics.topSkills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {analytics.topSkills.slice(0, 12).map((sk, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-md border bg-muted/30 px-2.5 py-1 text-xs font-medium text-foreground"
                    >
                      <span>{sk.name}</span>
                      <span className="text-[10px] font-semibold text-muted-foreground">{sk.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyChart label="No skills data available" compact />
              )}
            </CardContent>
          </Card>

          <Card className="shadow-2xs">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center gap-2">
                <GraduationCapIcon className="size-4 text-muted-foreground" />
                <CardTitle className="text-sm font-semibold">Qualification Distribution</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {analyticsLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : analytics?.candidatesByQualification && analytics.candidatesByQualification.length > 0 ? (
                <div className="space-y-2">
                  {analytics.candidatesByQualification.slice(0, 6).map((q, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate font-medium text-foreground" title={q.name}>
                        {q.name}
                      </span>
                      <span className="shrink-0 font-semibold text-muted-foreground">{q.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyChart label="No qualification data available" compact />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Candidate Pipeline + Resume Processing */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <UsersIcon className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Candidate Pipeline</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            {analyticsLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : analytics?.candidatePipeline && analytics.candidatePipeline.some((p) => p.count > 0) ? (
              <div className="space-y-2.5">
                {analytics.candidatePipeline.map((p, idx) => {
                  const max = Math.max(...analytics.candidatePipeline.map((x) => x.count), 1)
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium capitalize text-foreground">{p.status.replace(/_/g, " ")}</span>
                        <span className="font-semibold text-muted-foreground">{p.count}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${STATUS_BAR[p.status] || "bg-muted-foreground/40"}`}
                          style={{ width: `${(p.count / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyChart label="No pipeline data available" compact />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <FileTextIcon className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Resume Processing</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            {analyticsLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : analytics?.resumeProcessingStatus && analytics.resumeProcessingStatus.some((s) => s.count > 0) ? (
              <div className="flex flex-wrap gap-2">
                {analytics.resumeProcessingStatus.map((s, idx) => (
                  <div
                    key={idx}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium capitalize ${RESUME_STATUS_BADGE[s.status] || "bg-muted text-muted-foreground"}`}
                  >
                    <span>{s.status.replace(/_/g, " ")}</span>
                    <span className="rounded-full bg-background/60 px-1.5 text-[10px] font-bold">{s.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyChart label="No processing data available" compact />
            )}
          </CardContent>
        </Card>
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
                        {c.status.replace(/_/g, " ")}
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

      <ScanZohoModal open={scanModalOpen} onOpenChange={setScanModalOpen} />
    </div>
  )
}

"use client"

import { useState } from "react"
import { DashboardView, type DashboardDetail } from "./dashboard-view"
import { CandidatesView } from "./candidates-view"
import { ResumesView } from "./resumes-view"
import { AiSearchView } from "./ai-search-view"
import { JobsMatchingView } from "./jobs-matching-view"
import { ScanZohoModal } from "./scan-zoho-modal"
import { useRecruitmentStats, useRecruitmentAnalytics } from "../hooks"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@/constants/permissions"
import type { CandidateStatus } from "@/types/recruitment"
import {
  UsersIcon,
  FileTextIcon,
  StarIcon,
  XCircleIcon,
  RefreshCwIcon,
  MailSearchIcon,
  FileQuestionIcon,
  type LucideIcon,
} from "lucide-react"

interface Kpi {
  key: string
  label: string
  value: number | undefined
  caption?: string
  icon: LucideIcon
  iconTint: string
  wash: string
  onClick?: () => void
}

export function RecruitmentWorkspace() {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "candidates" | "resumes" | "search" | "jobs" | "shortlisted"
  >("resumes")
  const [scanModalOpen, setScanModalOpen] = useState(false)
  const [dashboardDetail, setDashboardDetail] = useState<DashboardDetail | null>(null)
  const [candidatesFilter, setCandidatesFilter] = useState<CandidateStatus | "">("")
  const [resumesFilter, setResumesFilter] = useState<string>("")
  const [resumesCandidateStatusFilter, setResumesCandidateStatusFilter] = useState<string>("")

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useRecruitmentStats()
  const { refetch: refetchAnalytics } = useRecruitmentAnalytics()
  const canProcess = usePermission([PERMISSIONS.recruitmentManage, PERMISSIONS.resumesProcess])

  // KPI cards (and pipeline/processing stages inside the Dashboard tab) open a
  // real, filtered detail panel inline at the top of the Dashboard — they
  // never navigate away from the current context.
  const openDashboardDetail = (detail: DashboardDetail) => {
    setDashboardDetail(detail)
    setActiveTab("dashboard")
  }

  // Plain tab navigation — used by "View all" links and manual tab clicks.
  // An optional filter seeds the Candidates/Resumes view's initial status.
  function navigateTab(tab: string, filter?: string) {
    if (tab === "candidates") setCandidatesFilter((filter as CandidateStatus) || "")
    if (tab === "resumes") {
      setResumesFilter(filter || "")
      setResumesCandidateStatusFilter("")
    }
    setActiveTab(tab as any)
  }

  // Needs Review / Rejected Resumes Quick Stats — filter Resumes by the
  // candidate's eligibility status (a different dimension than the
  // processing-status filter navigateTab sets above).
  function openResumesByCandidateStatus(candidateStatus: string) {
    setResumesFilter("")
    setResumesCandidateStatusFilter(candidateStatus)
    setActiveTab("resumes")
  }

  // Exactly 3 Quick Stats — all resume-oriented, matching the Resumes-first
  // UI. There's no automatic "Needs Review" middle state: a resume either
  // confirms all 4 criteria (Shortlisted) or it doesn't (Rejected) — see
  // Recruitment::EligibilityEvaluator. Each card routes to the Resumes tab
  // filtered accordingly so every number is actually reachable, now that the
  // full Candidates/Dashboard workspace is hidden.
  const kpis: Kpi[] = [
    {
      key: "total",
      label: "Total Resumes",
      value: stats?.totalResumes,
      caption: "All time",
      icon: FileTextIcon,
      iconTint: "bg-role-recruitment text-role-recruitment-foreground",
      wash: "bg-role-recruitment/10 border-role-recruitment/15",
      onClick: () => navigateTab("resumes"),
    },
    {
      key: "shortlisted",
      label: "Shortlisted Resumes",
      value: stats?.shortlistedResumes,
      caption: "Passed all 4 criteria",
      icon: StarIcon,
      iconTint: "bg-emerald-500 text-white",
      wash: "bg-emerald-500/10 border-emerald-500/15",
      onClick: () => openResumesByCandidateStatus("shortlisted"),
    },
    {
      key: "rejected",
      label: "Rejected Resumes",
      value: stats?.rejectedResumes,
      caption: "Reviewed & declined",
      icon: XCircleIcon,
      iconTint: "bg-red-500 text-white",
      wash: "bg-red-500/10 border-red-500/15",
      onClick: () => openResumesByCandidateStatus("rejected"),
    },
    {
      key: "other",
      label: "Other",
      value: stats?.otherResumes,
      caption: "Not a resume",
      icon: FileQuestionIcon,
      iconTint: "bg-slate-500 text-white",
      wash: "bg-slate-500/10 border-slate-500/15",
      onClick: () => navigateTab("resumes", "not_a_resume"),
    },
    // Hired KPI/action hidden for this rollout — `hiredThisMonth` and the
    // `offered` status stay fully intact in the backend.
  ]

  // Dashboard/Candidates/Job Matching stay fully implemented (components,
  // routes, and their "View all" targets from navigateTab below) but are
  // hidden from this tab bar for the current rollout — not deleted.
  // Resumes/AI Discovery tabs commented out per request — activeTab still
  // defaults to "resumes" below, so that view keeps rendering by default
  // with no visible tab bar to switch away from it.
  const tabs: { id: string; label: string; icon: LucideIcon; badge?: string }[] = [
    // {
    //   id: "resumes",
    //   label: "Resumes",
    //   icon: FileTextIcon,
    //   badge: stats?.newResumes ? `+${stats.newResumes}` : undefined,
    // },
    // {
    //   id: "search",
    //   label: "AI Discovery",
    //   icon: SparklesIcon,
    // },
    // Shortlisted tab hidden — reachable via the "Shortlisted Resumes" Quick
    // Stat card instead, same as Needs Review/Rejected (filters Resumes by
    // candidate status rather than being its own tab). CandidatesView/the
    // "shortlisted" panel below stay intact, just unreachable via the bar.
  ]

  return (
    <div className="space-y-6">
      {/* Page header — always visible, above the tabs, regardless of which
          tab is active */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-role-recruitment/12 text-role-recruitment">
            <UsersIcon className="size-7" />
          </span>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Recruitment</h2>
            <p className="text-sm text-muted-foreground">Candidate intelligence and hiring overview</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              refetchStats()
              refetchAnalytics()
            }}
            className="gap-1.5"
          >
            <RefreshCwIcon className="size-4" />
            Refresh
          </Button>

          {canProcess && (
            <Button onClick={() => setScanModalOpen(true)} className="gap-1.5 shadow-sm">
              <MailSearchIcon className="size-4" />
              Scan Mail
            </Button>
          )}

        </div>
      </div>

      {/* KPI Cards — above the tabs, visible on every tab */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick Stats</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {kpis.map((kpi) => (
            <Card
              key={kpi.key}
              onClick={kpi.onClick}
              role={kpi.onClick ? "button" : undefined}
              tabIndex={kpi.onClick ? 0 : undefined}
              onKeyDown={
                kpi.onClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        kpi.onClick!()
                      }
                    }
                  : undefined
              }
              className={`border shadow-2xs transition-all ${kpi.wash} ${
                kpi.onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md" : ""
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${kpi.iconTint}`}>
                    <kpi.icon className="size-4.5" />
                  </span>
                  <div className="text-2xl font-bold text-foreground">
                    {statsLoading ? <Skeleton className="h-7 w-10" /> : (kpi.value ?? 0)}
                  </div>
                </div>
                <p className="mt-2 truncate text-xs text-foreground/70">{kpi.label}</p>
                {kpi.caption && <p className="mt-2 text-[11px] text-foreground/70">{kpi.caption}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Workspace Navigation Bar — omitted entirely while there are no
          visible tabs, rather than rendering an empty bordered bar. */}
      {tabs.length > 0 && (
      <div className="relative border-b">
        <div className="flex items-center gap-5 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => (tab.id === "candidates" || tab.id === "resumes" ? navigateTab(tab.id) : setActiveTab(tab.id as any))}
                className={`relative flex items-center gap-2 whitespace-nowrap px-1 py-3.5 text-sm font-medium transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`size-4.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                      isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
                {isActive && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
              </button>
            )
          })}
        </div>
        {/* Fade hint that more tabs are scrollable off-screen — only needed
            below the breakpoint where all tabs fit without scrolling. */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent lg:hidden" />
      </div>
      )}

      {/* Tab Panels */}
      <div>
        {activeTab === "dashboard" && (
          <DashboardView
            onNavigateTab={navigateTab}
            detail={dashboardDetail}
            onOpenDetail={openDashboardDetail}
            onCloseDetail={() => setDashboardDetail(null)}
          />
        )}
        {activeTab === "candidates" && <CandidatesView key={candidatesFilter} initialStatus={candidatesFilter} />}
        {activeTab === "resumes" && (
          <ResumesView
            key={`${resumesFilter}:${resumesCandidateStatusFilter}`}
            initialStatus={resumesFilter}
            initialCandidateStatus={resumesCandidateStatusFilter}
          />
        )}
        {activeTab === "search" && <AiSearchView />}
        {activeTab === "jobs" && <JobsMatchingView />}
        {activeTab === "shortlisted" && <CandidatesView initialStatus="shortlisted" />}
      </div>

      <ScanZohoModal open={scanModalOpen} onOpenChange={setScanModalOpen} />
    </div>
  )
}

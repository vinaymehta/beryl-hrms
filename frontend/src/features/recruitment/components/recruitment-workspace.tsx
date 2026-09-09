"use client"

import { useState } from "react"
import { DashboardView } from "./dashboard-view"
import { CandidatesView } from "./candidates-view"
import { ResumesView } from "./resumes-view"
import { AiSearchView } from "./ai-search-view"
import { JobsMatchingView } from "./jobs-matching-view"
import { useRecruitmentStats } from "../hooks"
import {
  LayoutDashboardIcon,
  UsersIcon,
  FileTextIcon,
  SparklesIcon,
  BriefcaseIcon,
  StarIcon,
} from "lucide-react"

export function RecruitmentWorkspace() {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "candidates" | "resumes" | "search" | "jobs" | "shortlisted"
  >("dashboard")

  const { data: stats } = useRecruitmentStats()

  const tabs = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboardIcon,
    },
    {
      id: "candidates",
      label: "Candidates",
      icon: UsersIcon,
      badge: stats?.totalCandidates,
    },
    {
      id: "resumes",
      label: "Resumes & Ingestion",
      icon: FileTextIcon,
      badge: stats?.newResumes ? `+${stats.newResumes}` : undefined,
    },
    {
      id: "search",
      label: "AI Discovery",
      icon: SparklesIcon,
    },
    {
      id: "jobs",
      label: "Job Matching",
      icon: BriefcaseIcon,
    },
    {
      id: "shortlisted",
      label: "Shortlisted",
      icon: StarIcon,
      badge: stats?.shortlistedCandidates,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Workspace Navigation Bar */}
      <div className="border-b bg-card/50 rounded-xl p-1.5 shadow-2xs">
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className={`size-3.5 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === "dashboard" && (
          <DashboardView onNavigateTab={(t) => setActiveTab(t as any)} />
        )}
        {activeTab === "candidates" && <CandidatesView />}
        {activeTab === "resumes" && <ResumesView />}
        {activeTab === "search" && <AiSearchView />}
        {activeTab === "jobs" && <JobsMatchingView />}
        {activeTab === "shortlisted" && <CandidatesView initialStatus="shortlisted" />}
      </div>
    </div>
  )
}

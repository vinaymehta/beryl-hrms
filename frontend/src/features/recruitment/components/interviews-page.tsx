"use client"

import { useState } from "react"

import { InterviewsDashboard } from "./interviews-dashboard"
import { MyInterviewsView } from "./my-interviews-view"
import { PERMISSIONS } from "@/constants/permissions"
import { useCurrentUser } from "@/features/auth/hooks/use-current-user"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { cn } from "cn"

type Tab = "all" | "mine"

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All interviews" },
  { id: "mine", label: "My interviews" },
]

/**
 * One Interviews tab for both audiences: Recruitment access gets the company
 * dashboard, anyone with an Employee record gets the interviews they were
 * picked for, and someone with both switches between them.
 */
export function InterviewsTabs({ initialTab }: { initialTab: Tab }) {
  const { user } = useCurrentUser()
  const canSeeAll = usePermission([PERMISSIONS.recruitmentView, PERMISSIONS.candidatesView])
  const [tab, setTab] = useState<Tab>(initialTab)

  if (!user) return null
  if (!canSeeAll) return <MyInterviewsView />
  if (!user.employeeId) return <InterviewsDashboard />

  // Sits under whichever view's header, so the switch reads as page tabs.
  const tabs = (
    <div role="tablist" aria-label="Interviews" className="flex gap-4 border-b">
      {TABS.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={tab === option.id}
          onClick={() => setTab(option.id)}
          className={cn(
            "-mb-px border-b-2 px-1 pb-2 text-sm whitespace-nowrap transition-colors",
            tab === option.id
              ? "border-role-recruitment font-medium text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )

  return tab === "all" ? <InterviewsDashboard tabs={tabs} /> : <MyInterviewsView tabs={tabs} />
}

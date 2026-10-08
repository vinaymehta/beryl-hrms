"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { UserIcon, FileTextIcon } from "lucide-react"
import { cn } from "cn"

import { EmployeeRecordPanel } from "@/features/employees/components/employee-record-panel"
import { RECORD_PANELS } from "@/features/employees/record-panels"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@/constants/permissions"

/**
 * The §3 profile tabs, over the existing Overview sections rather than
 * replacing them — Overview is the cards that were already there, and each
 * further tab is one generic record panel.
 *
 * Only some record panels are offered: Assets to everyone, and History to
 * those who may read it (Admin and HR — employee_history.view). Compensation,
 * Goals, Skills, Training and PIP are not shown for now. Hidden outright, not
 * merely greyed out.
 */
/** The record panels shown as tabs, by resource. */
const VISIBLE_PANELS = new Set(["employment_events", "assets"])

export function EmployeeRecordTabs({
  employeeId,
  overview,
  documents,
}: {
  employeeId: string
  overview: React.ReactNode
  documents: React.ReactNode
}) {
  const canSeeHistory = usePermission(PERMISSIONS.employeeHistoryView)
  // ?tab=documents (and the like) opens straight on that tab — the self-appraisal
  // links here when Aadhaar/PAN still have to be uploaded.
  const requestedTab = useSearchParams().get("tab")
  const [selected, setSelected] = useState<string>(requestedTab ?? "overview")

  const panels = RECORD_PANELS.filter(
    (panel) => VISIBLE_PANELS.has(panel.resource) && (panel.resource !== "employment_events" || canSeeHistory)
  )

  const tabs = [
    { id: "overview", label: "Overview", icon: UserIcon },
    ...panels.map((panel) => ({ id: panel.resource, label: panel.label, icon: panel.icon })),
    { id: "documents", label: "Documents", icon: FileTextIcon },
  ]

  // A link to a tab that isn't offered (?tab=goals) lands on Overview.
  const active = tabs.some((tab) => tab.id === selected) ? selected : "overview"
  const activePanel = panels.find((panel) => panel.resource === active)

  return (
    <div className="grid gap-4">
      <div className="-mx-1 flex flex-wrap gap-1 overflow-x-auto border-b px-1 pb-px">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelected(tab.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-sm transition-colors",
                isActive
                  ? "border-role-hr font-semibold text-role-hr"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {active === "overview" && overview}
      {active === "documents" && documents}
      {activePanel && <EmployeeRecordPanel employeeId={employeeId} spec={activePanel} />}
    </div>
  )
}

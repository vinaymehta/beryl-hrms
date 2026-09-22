"use client"

import { useState } from "react"
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
 * A restricted tab (compensation) is hidden outright from anyone without its
 * key, so pay data isn't merely collapsed behind a click.
 */
export function EmployeeRecordTabs({
  employeeId,
  overview,
  documents,
}: {
  employeeId: string
  overview: React.ReactNode
  documents: React.ReactNode
}) {
  const canSeeCompensation = usePermission(PERMISSIONS.compensationManage)
  const [active, setActive] = useState<string>("overview")

  const panels = RECORD_PANELS.filter((panel) => !panel.restricted || canSeeCompensation)

  const tabs = [
    { id: "overview", label: "Overview", icon: UserIcon },
    ...panels.map((panel) => ({ id: panel.resource, label: panel.label, icon: panel.icon })),
    { id: "documents", label: "Documents", icon: FileTextIcon },
  ]

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
              onClick={() => setActive(tab.id)}
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

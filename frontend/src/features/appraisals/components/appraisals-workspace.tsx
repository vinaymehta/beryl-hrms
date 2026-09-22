"use client"

import { useState } from "react"
import {
  CalendarClockIcon, ClipboardListIcon, InboxIcon, UserIcon, TrendingUpIcon, LayersIcon, ScaleIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "cn"

import { Skeleton } from "@/components/ui/skeleton"
import { AppraisalList } from "@/features/appraisals/components/appraisal-list"
import { AppraisalCyclesView } from "@/features/appraisals/components/appraisal-cycles-view"
import { TemplatesView } from "@/features/appraisals/components/templates-view"
import { CalibrationView } from "@/features/appraisals/components/calibration-view"
import { AppraisalDetail } from "@/features/appraisals/components/appraisal-detail"
import { useAppraisals, useAppraisalCycles } from "@/features/appraisals/hooks/use-appraisals"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@/constants/permissions"

type TabId = "cycles" | "templates" | "calibration" | "all" | "mine" | "pending"

/**
 * The Appraisal workspace — its own top-level area, deliberately not nested
 * under Employees: a cycle is a company-wide process, and an ordinary employee
 * reaches their own appraisal here rather than through the people directory.
 *
 * Which tabs appear is decided by permission keys, so the same component serves
 * HR/Admin (everything), a manager (Pending Reviews + My Appraisal) and an
 * employee (My Appraisal alone).
 */
/**
 * Calibration is per-cycle, so it needs one chosen before it can show anything.
 * Defaults to the most recent started cycle, which is nearly always the one
 * being calibrated.
 */
function CalibrationPane({
  cycleFilter,
  onPickCycle,
  onOpen,
}: {
  cycleFilter: string | undefined
  onPickCycle: (id: string) => void
  onOpen: (id: string) => void
}) {
  const { data: cycles, isLoading } = useAppraisalCycles()
  const started = (cycles ?? []).filter((cycle) => cycle.started)
  const selected = cycleFilter ?? started[0]?.id

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />
  if (started.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-10 text-center text-xs text-muted-foreground">
        Calibration opens once a cycle has been started.
      </p>
    )
  }

  return (
    <div className="grid gap-3">
      {started.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {started.map((cycle) => (
            <button
              key={cycle.id}
              type="button"
              onClick={() => onPickCycle(cycle.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                selected === cycle.id
                  ? "border-role-hr bg-role-hr text-role-hr-foreground"
                  : "hover:bg-accent"
              )}
            >
              {cycle.name}
            </button>
          ))}
        </div>
      )}
      {selected && <CalibrationView cycleId={selected} onOpen={onOpen} />}
    </div>
  )
}

export function AppraisalsWorkspace() {
  const canViewCycles = usePermission(PERMISSIONS.appraisalCyclesView)
  const canViewTemplates = usePermission(PERMISSIONS.appraisalTemplatesView)
  const canViewAll = usePermission(PERMISSIONS.appraisalsViewAll)
  const canReview = usePermission(PERMISSIONS.appraisalsReview)
  const canSubmitSelf = usePermission(PERMISSIONS.appraisalsSubmitSelf)

  // Fetched separately so the Pending tab can carry a count — a manager whose
  // only reason to be here is one waiting review shouldn't have to go looking.
  const { data: pending } = useAppraisals({ scope: "pending" }, canReview)
  const pendingCount = pending?.length ?? 0

  const allTabs: { id: TabId; label: string; icon: LucideIcon; visible: boolean; badge?: number }[] = [
    { id: "cycles", label: "Appraisal cycles", icon: CalendarClockIcon, visible: canViewCycles },
    { id: "templates", label: "Templates", icon: LayersIcon, visible: canViewTemplates },
    // Calibration is inherently a view across other people's appraisals, so it
    // follows appraisals.view_all rather than the reviewer scope.
    { id: "calibration", label: "Calibration", icon: ScaleIcon, visible: canViewAll },
    { id: "all", label: "Employee appraisals", icon: ClipboardListIcon, visible: canViewAll },
    { id: "pending", label: "Pending reviews", icon: InboxIcon, visible: canReview, badge: pendingCount },
    { id: "mine", label: "My appraisal", icon: UserIcon, visible: canSubmitSelf },
  ]
  const tabs = allTabs.filter((tab) => tab.visible)

  // Land people where their work actually is: HR/Admin run cycles, a manager
  // with something waiting goes to it, and everyone else came for their own
  // appraisal — not for an empty Pending list.
  const defaultTab: TabId = canViewCycles
    ? "cycles"
    : canReview && pendingCount > 0
      ? "pending"
      : canSubmitSelf
        ? "mine"
        : (tabs[0]?.id ?? "mine")

  const [activeTab, setActiveTab] = useState<TabId | null>(null)
  const currentTab = activeTab ?? defaultTab
  const [openAppraisalId, setOpenAppraisalId] = useState<string | null>(null)
  const [cycleFilter, setCycleFilter] = useState<string | undefined>(undefined)

  const listScope = currentTab === "mine" ? "mine" : currentTab === "pending" ? "pending" : undefined
  const { data, isLoading, isError, refetch } = useAppraisals(
    { scope: listScope, cycleId: currentTab === "all" ? cycleFilter : undefined },
    currentTab !== "cycles" && currentTab !== "templates" && currentTab !== "calibration"
  )

  if (openAppraisalId) {
    return <AppraisalDetail appraisalId={openAppraisalId} onBack={() => setOpenAppraisalId(null)} />
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-role-hr/12 text-role-hr">
            <TrendingUpIcon className="size-4.5" />
          </span>
          <div>
            <h1 className="text-2xl leading-tight font-semibold tracking-tight">Appraisal</h1>
            <p className="text-xs text-muted-foreground">
              Cycles, self-appraisals, manager reviews and released outcomes.
            </p>
          </div>
        </div>
      </div>

      {tabs.length > 1 && (
        <div className="flex flex-wrap gap-1.5 border-b pb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = currentTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-sm transition-colors",
                  active
                    ? "border-role-hr font-semibold text-role-hr"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {tab.label}
                {tab.badge ? (
                  <span className="rounded-full bg-role-hr px-1.5 text-[10px] font-bold text-role-hr-foreground">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      )}

      {currentTab === "templates" ? (
        <TemplatesView />
      ) : currentTab === "calibration" ? (
        <CalibrationPane
          cycleFilter={cycleFilter}
          onPickCycle={setCycleFilter}
          onOpen={setOpenAppraisalId}
        />
      ) : currentTab === "cycles" ? (
        <AppraisalCyclesView
          onOpenCycle={(cycleId) => {
            setCycleFilter(cycleId)
            setActiveTab("all")
          }}
        />
      ) : isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <>
          {currentTab === "all" && cycleFilter && (
            <button
              type="button"
              className="w-fit text-xs text-muted-foreground underline"
              onClick={() => setCycleFilter(undefined)}
            >
              Showing one cycle — clear filter
            </button>
          )}
          <AppraisalList
            appraisals={data ?? []}
            isLoading={false}
            isError={isError}
            onRetry={() => refetch()}
            onOpen={setOpenAppraisalId}
            showEmployee={currentTab !== "mine"}
            emptyTitle={
              currentTab === "pending"
                ? "Nothing waiting on you"
                : currentTab === "mine"
                  ? "You have no appraisal yet"
                  : "No appraisals yet"
            }
            emptyHint={
              currentTab === "pending"
                ? "Appraisals appear here when the workflow reaches the stage you own."
                : currentTab === "mine"
                  ? "Your appraisal appears here once HR starts a cycle that includes you."
                  : "Start a cycle to create appraisals for its eligible employees."
            }
          />
        </>
      )}
    </div>
  )
}

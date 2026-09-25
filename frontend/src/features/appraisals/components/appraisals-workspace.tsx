"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  CalendarClockIcon, ClipboardListIcon, InboxIcon, UserIcon, TrendingUpIcon, LayersIcon, ScaleIcon,
  SearchIcon, ChevronLeftIcon, ChevronRightIcon, XIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "cn"

import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { FilterPanel } from "@/components/ui/filter-panel"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDebounced } from "@/hooks/use-debounced"
import { AppraisalList } from "@/features/appraisals/components/appraisal-list"
import { AppraisalCyclesView } from "@/features/appraisals/components/appraisal-cycles-view"
import { TemplatesView } from "@/features/appraisals/components/templates-view"
import { CalibrationView } from "@/features/appraisals/components/calibration-view"
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
  // perPage: 1 — this exists only for the badge, and the server's own count is
  // the answer. Fetching a page of rows to measure its length would be paying
  // for data nothing renders.
  const { data: pending } = useAppraisals({ scope: "pending", perPage: 1 }, canReview)
  const pendingCount = pending?.meta.totalCount ?? 0

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

  // The tab lives in the URL so leaving for a full page — creating a template,
  // say — and coming back lands where you were rather than on the default.
  const router = useRouter()
  const requestedTab = useSearchParams().get("tab") as TabId | null
  const [activeTab, setActiveTab] = useState<TabId | null>(null)
  const fromUrl = tabs.some((tab) => tab.id === requestedTab) ? requestedTab : null
  const currentTab = activeTab ?? fromUrl ?? defaultTab

  // Opening an appraisal NAVIGATES rather than swapping this component out:
  // the workspace writes its active section to ?tab=, which only survives a
  // refresh if the appraisal has a URL of its own.
  const openAppraisal = (id: string) => router.push(`/appraisals/${id}`)
  const [cycleFilter, setCycleFilter] = useState<string | undefined>(undefined)

  // Every cycle, newest first — the same order the Cycles tab shows them in.
  const { data: allCycles } = useAppraisalCycles()
  const cycleItems = [
    { value: "all", label: "All cycles" },
    ...(allCycles ?? []).map((cycle) => ({ value: cycle.id, label: cycle.name })),
  ]
  // Paging and searching are server-side, so both live here and go out as
  // query params rather than filtering what has already arrived.
  const [perPage, setPerPage] = useState(10)
  const [search, setSearch] = useState("")
  const query = useDebounced(search, 300)

  function selectTab(tab: TabId) {
    setActiveTab(tab)
    router.replace(`/appraisals?tab=${tab}`, { scroll: false })
  }

  // A narrowed search or a smaller page size almost never has the page you
  // were on, and landing on an empty page reads as "no results" when there are
  // plenty. So the page is DERIVED: it survives only while the filters that
  // produced it are unchanged, and falls back to 1 the moment they aren't.
  //
  // Derived rather than reset in an effect, which would set state during
  // render's commit and cost a second pass every time anybody typed.
  const filterSignature = [ currentTab, query, perPage, cycleFilter ?? "" ].join("|")
  const [paging, setPaging] = useState({ signature: filterSignature, page: 1 })
  const page = paging.signature === filterSignature ? paging.page : 1
  const setPage = (next: number) => setPaging({ signature: filterSignature, page: next })

  const listScope = currentTab === "mine" ? "mine" : currentTab === "pending" ? "pending" : undefined
  const { data: listed, isPending: listLoading, isError, refetch } = useAppraisals(
    {
      scope: listScope,
      cycleId: currentTab === "all" ? cycleFilter : undefined,
      page,
      perPage,
      q: query || undefined,
    },
    currentTab !== "cycles" && currentTab !== "templates" && currentTab !== "calibration"
  )
  const appraisals = listed?.data ?? []
  const meta = listed?.meta


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
                onClick={() => selectTab(tab.id)}
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
          onOpen={openAppraisal}
        />
      ) : currentTab === "cycles" ? (
        <AppraisalCyclesView
          onOpenCycle={(cycleId) => {
            setCycleFilter(cycleId)
            selectTab("all")
          }}
        />
      ) : (
        <>
          {/* Search is server-side and applies to every page, not to the ten
              rows already on screen.
              
              Mounted OUTSIDE the loading branch, and that is load-bearing: a
              keystroke changes the query key, which put the whole block into
              its loading state and replaced this input with a skeleton — so
              the field unmounted mid-word and the caret was lost after every
              character. Only the LIST may be swapped for a skeleton. */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, code or email"
                aria-label="Search appraisals"
                className="pl-8"
              />
            </div>
            {currentTab === "all" && (
              <>
                {/* The cycle filter used to be reachable only by arriving from
                    the Cycles tab, and clearable only through a line of
                    underlined text. It is a filter, so it uses the same panel
                    as every other list — and keeps a separate Clear beside the
                    trigger, because arriving here already filtered is the
                    common case. */}
                <FilterPanel
                  activeCount={cycleFilter ? 1 : 0}
                  onReset={() => setCycleFilter(undefined)}
                  ariaLabel="Filter appraisals"
                  title="Filter appraisals"
                  accentClassName="border-role-hr text-role-hr bg-role-hr/5"
                  badgeClassName="bg-role-hr text-role-hr-foreground"
                >
                  <div className="grid gap-1.5">
                    <Label htmlFor="appraisal-filter-cycle">Cycle</Label>
                    <Select
                      items={cycleItems}
                      value={cycleFilter ?? "all"}
                      onValueChange={(v) => setCycleFilter(!v || v === "all" ? undefined : v)}
                    >
                      <SelectTrigger id="appraisal-filter-cycle" aria-label="Filter by cycle" className="h-9 w-full">
                        <SelectValue placeholder="Cycle" />
                      </SelectTrigger>
                      <SelectContent>
                        {cycleItems.map((cycle) => (
                          <SelectItem key={cycle.value} value={cycle.value}>{cycle.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </FilterPanel>
                {cycleFilter && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 text-muted-foreground"
                    onClick={() => setCycleFilter(undefined)}
                  >
                    <XIcon className="size-4" />
                    Clear filter
                  </Button>
                )}
              </>
            )}
            {meta && meta.totalCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {meta.totalCount} {meta.totalCount === 1 ? "appraisal" : "appraisals"}
              </p>
            )}
          </div>

          {listLoading ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : (
          <AppraisalList
            appraisals={appraisals}
            isLoading={false}
            isError={isError}
            onRetry={() => refetch()}
            onOpen={openAppraisal}
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
          )}

          {meta && meta.totalCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <label htmlFor="appraisals-per-page">Rows per page</label>
                <select
                  id="appraisals-per-page"
                  value={perPage}
                  onChange={(event) => setPerPage(Number(event.target.value))}
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {[ 10, 25, 50, 100 ].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground tabular-nums">
                  Page {meta.page} of {meta.totalPages}
                </p>
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label="Previous page"
                  disabled={meta.page <= 1}
                  onClick={() => setPage(Math.max(1, page - 1))}
                >
                  <ChevronLeftIcon className="size-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label="Next page"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRightIcon className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

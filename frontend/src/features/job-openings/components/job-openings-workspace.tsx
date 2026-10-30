"use client"

import { useMemo, useState, type MouseEvent, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  BriefcaseBusinessIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EyeOffIcon,
  GlobeIcon,
  LayersIcon,
  MapPinIcon,
  PlusIcon,
  SearchIcon,
  SearchXIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { JobAdminAccess } from "@/features/job-openings/components/job-admin-access"
import { OpeningMenu } from "@/features/job-openings/components/opening-menu"
import { StatusSwitch } from "@/features/job-openings/components/status-switch"
import { applicationsHref, postedDate } from "@/features/job-openings/format"
import { useJobOpeningActions, useJobOpenings } from "@/features/job-openings/hooks"
import type { JobOpening } from "@/types/job-openings"

type StatusFilter = "all" | "active" | "paused"

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "paused", label: "Paused" },
]

/** The desktop table's columns — header and rows share it so they line up. */
const COLUMNS =
  "lg:grid-cols-[4.5rem_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_6.5rem_6rem_8rem_2.25rem]"

function matchesFilter(opening: JobOpening, filter: StatusFilter) {
  return filter === "all" || (filter === "active" ? opening.isActive : !opening.isActive)
}

function matchesSearch(opening: JobOpening, query: string) {
  if (!query) return true
  return [opening.title, opening.code, opening.category].some((value) => value.toLowerCase().includes(query))
}

/**
 * Job Administration — the openings on the public careers website. Active
 * ones are published (the website reads them from the public API in this
 * order); paused ones are kept here, out of sight.
 */
export function JobOpeningsWorkspace() {
  return (
    <JobAdminAccess>
      <Workspace />
    </JobAdminAccess>
  )
}

interface RowHandlers {
  onMove: (opening: JobOpening, direction: -1 | 1) => void
  onToggle: (opening: JobOpening) => void
}

function Workspace() {
  const { data, isLoading, isError, refetch } = useJobOpenings()
  const { setActive, reorder } = useJobOpeningActions()
  const [filter, setFilter] = useState<StatusFilter>("all")
  const [search, setSearch] = useState("")

  const openings = useMemo(() => data ?? [], [data])
  const query = search.trim().toLowerCase()
  const visible = useMemo(
    () => openings.filter((opening) => matchesFilter(opening, filter) && matchesSearch(opening, query)),
    [openings, filter, query]
  )
  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map(({ id }) => [id, openings.filter((opening) => matchesFilter(opening, id)).length])),
    [openings]
  ) as Record<StatusFilter, number>

  /**
   * Swaps the opening with its neighbour in the list being shown — under a
   * filter, the next one up or down that is visible — and saves the whole
   * order, so positions stay 1…n with no gaps.
   */
  function move(opening: JobOpening, direction: -1 | 1) {
    const neighbour = visible[visible.indexOf(opening) + direction]
    if (!neighbour) return
    const next = [...openings]
    const a = next.indexOf(opening)
    const b = next.indexOf(neighbour)
    ;[next[a], next[b]] = [next[b], next[a]]
    reorder.mutate({ ordered: next })
  }

  const handlers: RowHandlers = {
    onMove: move,
    onToggle: (opening) => setActive.mutate({ opening, active: !opening.isActive }),
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-role-admin/12 text-role-admin">
            <BriefcaseBusinessIcon className="size-5.5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">Job Administration</h1>
            <p className="text-xs text-muted-foreground">
              The openings on the careers website. Active ones are live, in the order shown here.
            </p>
          </div>
        </div>
        <Button
          size="lg"
          className="gap-1.5 bg-role-admin text-role-admin-foreground shadow-sm hover:bg-role-admin/90 sm:w-auto"
          nativeButton={false}
          render={<Link href="/job-administration/new" />}
        >
          <PlusIcon className="size-4" />
          New job opening
        </Button>
      </div>

      {isLoading ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
          <ListSkeleton />
        </>
      ) : isError ? (
        <div className="grid gap-3 rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm font-semibold text-foreground">Couldn&apos;t load the job openings</p>
          <p className="text-xs text-muted-foreground">
            The request didn&apos;t reach the server. Check your connection and try again.
          </p>
          <div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        </div>
      ) : !openings.length ? (
        <EmptyState
          icon={BriefcaseBusinessIcon}
          title="No job openings yet"
          description="Create the first opening. Once it's active, it appears on the careers website."
          action={
            <Button
              className="gap-1.5 bg-role-admin text-role-admin-foreground hover:bg-role-admin/90"
              nativeButton={false}
              render={<Link href="/job-administration/new" />}
            >
              <PlusIcon className="size-4" /> New job opening
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="Total"
              value={counts.all}
              caption="Openings in this list"
              icon={LayersIcon}
              tint="bg-role-admin text-role-admin-foreground"
              wash="bg-role-admin/6 border-role-admin/15"
            />
            <Stat
              label="Active"
              value={counts.active}
              caption="Live on the website"
              icon={GlobeIcon}
              tint="bg-success text-success-foreground"
              wash="bg-success/6 border-success/15"
            />
            <Stat
              label="Paused"
              value={counts.paused}
              caption="Hidden from the website"
              icon={EyeOffIcon}
              tint="bg-muted-foreground/80 text-background"
              wash="bg-muted/60 border-border"
            />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div
                role="tablist"
                aria-label="Filter by status"
                className="flex w-full gap-0.5 rounded-lg border bg-muted/50 p-0.5 sm:w-fit"
              >
                {FILTERS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === option.id}
                    onClick={() => setFilter(option.id)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1 text-xs whitespace-nowrap transition-colors sm:flex-none",
                      filter === option.id
                        ? "bg-background font-medium text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {option.label}
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-[10px] tabular-nums",
                        filter === option.id ? "bg-role-admin/12 text-role-admin" : "bg-muted"
                      )}
                    >
                      {counts[option.id]}
                    </span>
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:max-w-72">
                <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 pl-8 text-xs"
                  aria-label="Search job openings"
                  placeholder="Search title, code, category…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {counts.active === 0 && (
              <p className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
                <EyeOffIcon className="size-3.5 shrink-0 text-warning" />
                Every opening is paused, so the careers website currently lists none.
              </p>
            )}

            {visible.length ? (
              <div className="overflow-hidden rounded-xl border bg-card shadow-2xs">
                <div
                  className={cn(
                    "hidden items-center gap-4 border-b bg-muted/40 px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase lg:grid",
                    COLUMNS
                  )}
                >
                  <span>Order</span>
                  <span>Opening</span>
                  <span>Category</span>
                  <span>Location</span>
                  <span>Type</span>
                  <span>Posted</span>
                  <span>Applications</span>
                  <span>Status</span>
                  <span className="sr-only">Actions</span>
                </div>
                <ul className="divide-y">
                  {visible.map((opening, index) => (
                    <OpeningRow
                      key={opening.id}
                      opening={opening}
                      position={openings.indexOf(opening) + 1}
                      canMoveUp={index > 0}
                      canMoveDown={index < visible.length - 1}
                      reordering={reorder.isPending}
                      toggling={setActive.isPending && setActive.variables?.opening.id === opening.id}
                      handlers={handlers}
                    />
                  ))}
                </ul>
              </div>
            ) : (
              <EmptyState
                icon={SearchXIcon}
                title={query ? `No openings match “${search.trim()}”` : `No ${filter} openings`}
                description={
                  query
                    ? "Search looks at the title, code and category."
                    : filter === "active"
                      ? "Nothing is live on the careers website right now."
                      : "Every opening is live on the careers website."
                }
                action={
                  query ? (
                    <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                      Clear search
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setFilter("all")}>
                      Show all openings
                    </Button>
                  )
                }
              />
            )}
          </div>
        </>
      )}

    </div>
  )
}

function OpeningRow({
  opening,
  position,
  canMoveUp,
  canMoveDown,
  reordering,
  toggling,
  handlers,
}: {
  opening: JobOpening
  position: number
  canMoveUp: boolean
  canMoveDown: boolean
  reordering: boolean
  toggling: boolean
  handlers: RowHandlers
}) {
  const router = useRouter()
  const detailHref = `/job-administration/${opening.id}`
  const reorderControls = (
    <Reorder
      title={opening.title}
      canMoveUp={canMoveUp && !reordering}
      canMoveDown={canMoveDown && !reordering}
      onMove={(direction) => handlers.onMove(opening, direction)}
    />
  )
  const status = (
    <StatusSwitch
      checked={opening.isActive}
      disabled={toggling}
      label={`Show ${opening.title} on the careers website`}
      onChange={() => handlers.onToggle(opening)}
    />
  )
  const menu = <OpeningMenu opening={opening} />

  /**
   * A click anywhere on the row opens the opening — except on its own
   * controls (switch, arrows, ⋯, links), and except clicks that bubble up
   * through React from the menu's portalled popup or dialogs, which are not
   * inside the row at all.
   */
  function openFromRow(event: MouseEvent<HTMLLIElement>) {
    const target = event.target as HTMLElement
    if (!event.currentTarget.contains(target) || target.closest("button, a, [role=switch], [role=menuitem]")) return
    router.push(detailHref)
  }

  return (
    <li onClick={openFromRow} className="group/row cursor-pointer transition-colors hover:bg-muted/40">
      {/* Desktop: one aligned table row. */}
      <div className={cn("hidden items-center gap-4 px-4 py-3 lg:grid", COLUMNS)}>
        <div className="flex items-center gap-1">
          <Position value={position} />
          {reorderControls}
        </div>
        <div className="grid min-w-0 gap-0.5">
          <Link href={detailHref} className="truncate text-sm font-semibold text-foreground hover:text-role-admin hover:underline">
            {opening.title}
          </Link>
          <span className="truncate font-mono text-[11px] text-muted-foreground">{opening.code}</span>
        </div>
        <span className="truncate text-sm text-foreground/80">{opening.category}</span>
        <span className="flex min-w-0 items-center gap-1 text-sm text-foreground/80">
          <MapPinIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{opening.location}</span>
        </span>
        <span className="truncate text-sm text-foreground/80">{opening.employmentType}</span>
        <span className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">{postedDate(opening.datePosted)}</span>
        <ApplicationsLink opening={opening} />
        {status}
        {menu}
      </div>

      {/* Mobile / tablet: a card. */}
      <div className="grid gap-3 p-4 lg:hidden">
        <div className="flex items-start gap-3">
          <Position value={position} />
          <div className="grid min-w-0 flex-1 gap-1">
            <Link href={detailHref} className="text-sm leading-snug font-semibold text-foreground hover:underline">
              {opening.title}
            </Link>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span className="font-mono text-[11px]">{opening.code}</span>
              <Dot />
              <span>{opening.category}</span>
              <Dot />
              <span>{opening.employmentType}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="size-3" />
                {opening.location}
              </span>
              <Dot />
              <span>Posted {postedDate(opening.datePosted)}</span>
              <Dot />
              <ApplicationsLink opening={opening} compact />
            </div>
          </div>
          {menu}
        </div>
        <div className="flex items-center justify-between gap-3 border-t pt-3">
          {status}
          {reorderControls}
        </div>
      </div>
    </li>
  )
}

/**
 * The opening's application count, linking to Recruitment's Resumes filtered
 * to them. A plain number when there are none — nothing to open.
 */
function ApplicationsLink({ opening, compact = false }: { opening: JobOpening; compact?: boolean }) {
  const count = opening.applicationsCount
  const label = compact ? `${count} ${count === 1 ? "application" : "applications"}` : count
  if (count === 0) {
    return <span className={cn("tabular-nums", compact ? "" : "text-sm text-muted-foreground")}>{label}</span>
  }
  return (
    <Link
      href={applicationsHref(opening.id)}
      title={`View ${count === 1 ? "the application" : `all ${count} applications`} in Recruitment`}
      className={cn(
        "w-fit font-medium tabular-nums text-role-admin hover:underline",
        compact ? "" : "text-sm"
      )}
    >
      {label}
    </Link>
  )
}

function Position({ value }: { value: number }) {
  return (
    <span
      className="flex size-7 shrink-0 items-center justify-center rounded-lg border bg-background text-xs font-semibold text-foreground tabular-nums"
      title={`Position ${value} on the website`}
    >
      {value}
    </span>
  )
}

/** Up/down, quiet until the row is hovered or a button is focused. */
function Reorder({
  title,
  canMoveUp,
  canMoveDown,
  onMove,
}: {
  title: string
  canMoveUp: boolean
  canMoveDown: boolean
  onMove: (direction: -1 | 1) => void
}) {
  const button =
    "flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-35"
  return (
    <div className="flex items-center gap-1 lg:flex-col lg:gap-0 lg:opacity-70 lg:transition-opacity lg:group-hover/row:opacity-100 lg:focus-within:opacity-100">
      <button
        type="button"
        aria-label={`Move ${title} up`}
        title="Move up"
        disabled={!canMoveUp}
        onClick={() => onMove(-1)}
        className={cn(button, "size-8 border lg:size-4 lg:border-0")}
      >
        <ChevronUpIcon className="size-4 lg:size-3.5" />
      </button>
      <button
        type="button"
        aria-label={`Move ${title} down`}
        title="Move down"
        disabled={!canMoveDown}
        onClick={() => onMove(1)}
        className={cn(button, "size-8 border lg:size-4 lg:border-0")}
      >
        <ChevronDownIcon className="size-4 lg:size-3.5" />
      </button>
    </div>
  )
}

function Dot() {
  return <span aria-hidden className="size-0.5 rounded-full bg-muted-foreground/60" />
}

function Stat({
  label,
  value,
  caption,
  icon: Icon,
  tint,
  wash,
}: {
  label: string
  value: number
  caption: string
  icon: LucideIcon
  tint: string
  wash: string
}) {
  return (
    <Card className={cn("border py-0 shadow-2xs ring-0", wash)}>
      <CardContent className="flex items-center gap-3 p-3 sm:px-4">
        <span className={cn("hidden size-9 shrink-0 items-center justify-center rounded-xl sm:flex", tint)}>
          <Icon className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground/80">{label}</p>
          <p className="hidden truncate text-[11px] text-muted-foreground sm:block">{caption}</p>
        </div>
        <span className="text-xl font-bold text-foreground tabular-nums sm:text-2xl">{value}</span>
      </CardContent>
    </Card>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="grid justify-items-center gap-2 rounded-xl border border-dashed bg-card/50 px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-role-admin/10 text-role-admin">
        <Icon className="size-5.5" />
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-md text-xs text-muted-foreground">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border shadow-2xs">
      <div className="grid gap-px bg-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 bg-card p-4">
            <Skeleton className="size-7 shrink-0 rounded-lg" />
            <div className="grid flex-1 gap-1.5">
              <Skeleton className="h-4 w-56 max-w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="hidden h-5 w-20 rounded-full sm:block" />
          </div>
        ))}
      </div>
    </div>
  )
}

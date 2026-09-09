"use client"

import Link from "next/link"
import { UsersIcon, Building2Icon, CalendarDaysIcon, ClockIcon, TrendingUpIcon, ActivityIcon, ArrowUpRightIcon } from "lucide-react"
import { cn } from "cn"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { RoleBadge } from "@/components/layout/role-badge"
import { AttendanceOverviewChart } from "@/features/dashboard/components/attendance-overview-chart"
import { useCurrentUser } from "@/features/auth/hooks/use-current-user"
import { useDashboardSummary } from "@/features/dashboard/hooks/use-dashboard-summary"

const ICON_TINT_CLASSES: Record<string, string> = {
  "role-hr": "bg-role-hr text-role-hr-foreground",
  warning: "bg-warning text-warning-foreground",
  info: "bg-info text-info-foreground",
}

const WASH_CLASSES: Record<string, string> = {
  "role-hr": "bg-role-hr/10 border-role-hr/15",
  warning: "bg-warning/10 border-warning/15",
  info: "bg-info/10 border-info/15",
}

export default function DashboardPage() {
  const { user, isLoading } = useCurrentUser()
  const { data: summary, isLoading: isSummaryLoading } = useDashboardSummary()

  // One highlighted "hero" metric (solid brand fill) + three lighter
  // info-panel metrics with distinct tinted icon chips — deliberately not
  // four identical white rectangles (see docs/DESIGN_SYSTEM.md "Cards").
  // Employees/Departments are real counts; the other two have no backing
  // model yet (Attendance/Leave arrive in Phase 5) so they stay an honest
  // placeholder rather than a faked number.
  const heroValue = isSummaryLoading ? null : (summary?.employeeCount ?? 0)
  const HERO_STAT = { label: "Employees", value: heroValue, icon: UsersIcon, href: "/employees" }
  const PANEL_STATS = [
    {
      label: "Departments",
      value: isSummaryLoading ? null : (summary?.departmentCount ?? 0),
      icon: Building2Icon,
      tint: "role-hr" as const,
      href: "/departments",
    },
    {
      label: "On leave today",
      value: isSummaryLoading ? null : (summary?.onLeaveToday ?? 0),
      icon: CalendarDaysIcon,
      tint: "warning" as const,
      href: "/leave",
    },
    {
      label: "Pending approvals",
      value: isSummaryLoading ? null : (summary?.pendingApprovals ?? 0),
      icon: ClockIcon,
      tint: "info" as const,
      href: "/leave",
    },
  ]

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 rounded-2xl border bg-gradient-to-br from-surface to-surface-muted p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {isLoading || !user ? (
            <Skeleton className="h-8 w-64" />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                Welcome back, {user.firstName}
              </h1>
              {user.roles.map((role) => (
                <RoleBadge key={role.id} name={role.name} slug={role.slug} />
              ))}
            </div>
          )}
          <div className="mt-1.5 text-sm text-muted-foreground">
            {user ? user.companyName : <Skeleton className="mt-1 h-4 w-40" />}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* One consistent counting-card layout across the app: a tinted icon
            chip on the left, the number on the right, then the label below
            — see the KPI cards in Mail and Recruitment for the same pattern. */}
        <Link href={HERO_STAT.href} className="group block h-full">
          <Card className="h-full border bg-primary/10 border-primary/15 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors">
                  <HERO_STAT.icon className="size-4.5" />
                </span>
                <div className="text-3xl font-bold text-foreground">
                  {HERO_STAT.value === null ? <Skeleton className="h-8 w-10" /> : HERO_STAT.value}
                </div>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-foreground/70">
                <span>{HERO_STAT.label}</span>
                <ArrowUpRightIcon className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
              <p className="mt-2 flex items-center gap-1 text-[11px] text-foreground/70 group-hover:text-primary transition-colors">
                <TrendingUpIcon className="size-3.5" /> Company headcount →
              </p>
            </CardContent>
          </Card>
        </Link>

        {PANEL_STATS.map((stat) => (
          <Link key={stat.label} href={stat.href} className="group block h-full">
            <Card className={cn("h-full border cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5", WASH_CLASSES[stat.tint])}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("flex size-9 items-center justify-center rounded-xl transition-colors", ICON_TINT_CLASSES[stat.tint])}>
                    <stat.icon className="size-4.5" />
                  </span>
                  <div className="text-3xl font-bold text-foreground">
                    {stat.value === null ? <Skeleton className="h-8 w-10" /> : stat.value}
                  </div>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-foreground/70">
                  <span>{stat.label}</span>
                  <ArrowUpRightIcon className="size-3 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
                </p>
                <p className="mt-2 text-[11px] text-foreground/70 group-hover:text-primary transition-colors">
                  View details →
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-role-hr to-info" />
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ActivityIcon className="size-4 text-role-hr" />
              Attendance this week
            </CardTitle>
            <CardDescription>Daily present headcount for the current week.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <AttendanceOverviewChart data={summary?.weeklyAttendance} />
        </CardContent>
      </Card>
    </div>
  )
}

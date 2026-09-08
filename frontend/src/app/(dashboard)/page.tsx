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

const TINT_CLASSES: Record<string, string> = {
  "role-hr": "bg-role-hr/12 text-role-hr",
  warning: "bg-warning/15 text-warning",
  info: "bg-info/12 text-info",
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
        {/* Hero card — the flagship metric gets a solid brand fill to anchor
            the row visually, per the brief's "highlighted summary card". */}
        <Link href={HERO_STAT.href} className="group block">
          <Card className="h-full border-none bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-primary-foreground/80 flex items-center gap-1.5">
                  <span>{HERO_STAT.label}</span>
                  <ArrowUpRightIcon className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
                <div className="text-3xl font-semibold">
                  {HERO_STAT.value === null ? (
                    <Skeleton className="h-8 w-10 bg-primary-foreground/20" />
                  ) : (
                    HERO_STAT.value
                  )}
                </div>
                <p className="mt-1 flex items-center gap-1 text-xs text-primary-foreground/70 group-hover:text-primary-foreground transition-colors">
                  <TrendingUpIcon className="size-3.5" /> Company headcount →
                </p>
              </div>
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary-foreground/15 group-hover:bg-primary-foreground/25 transition-colors">
                <HERO_STAT.icon className="size-5.5" />
              </span>
            </CardContent>
          </Card>
        </Link>

        {PANEL_STATS.map((stat) => (
          <Link key={stat.label} href={stat.href} className="group block">
            <Card className="h-full cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors flex items-center gap-1.5">
                    <span>{stat.label}</span>
                    <ArrowUpRightIcon className="size-3 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
                  </p>
                  <div className="text-3xl font-semibold">
                    {stat.value === null ? <Skeleton className="h-8 w-10" /> : stat.value}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                    View details →
                  </p>
                </div>
                <span className={cn("flex size-11 items-center justify-center rounded-xl transition-colors", TINT_CLASSES[stat.tint])}>
                  <stat.icon className="size-5.5" />
                </span>
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

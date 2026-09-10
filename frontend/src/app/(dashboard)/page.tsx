"use client"

import Link from "next/link"
import { UsersIcon, Building2Icon, TrendingUpIcon, ArrowUpRightIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { RoleBadge } from "@/components/layout/role-badge"
import { useCurrentUser } from "@/features/auth/hooks/use-current-user"
import { useDashboardSummary } from "@/features/dashboard/hooks/use-dashboard-summary"

export default function DashboardPage() {
  const { user, isLoading } = useCurrentUser()
  const { data: summary, isLoading: isSummaryLoading } = useDashboardSummary()

  // One highlighted "hero" metric (solid brand fill) + a lighter info-panel
  // metric — deliberately not identical white rectangles (see
  // docs/DESIGN_SYSTEM.md "Cards"). Attendance/Leave widgets are hidden for
  // this rollout (see src/constants/feature-flags.ts) without touching the
  // summary API those fields still come from.
  const heroValue = isSummaryLoading ? null : (summary?.employeeCount ?? 0)
  const HERO_STAT = { label: "Employees", value: heroValue, icon: UsersIcon, href: "/employees" }
  const DEPARTMENTS_STAT = {
    label: "Departments",
    value: isSummaryLoading ? null : (summary?.departmentCount ?? 0),
    icon: Building2Icon,
    href: "/departments",
  }

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

      <div className="grid gap-4 sm:grid-cols-2">
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

        <Link href={DEPARTMENTS_STAT.href} className="group block h-full">
          <Card className="h-full border cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 bg-role-hr/10 border-role-hr/15">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="flex size-9 items-center justify-center rounded-xl bg-role-hr text-role-hr-foreground transition-colors">
                  <DEPARTMENTS_STAT.icon className="size-4.5" />
                </span>
                <div className="text-3xl font-bold text-foreground">
                  {DEPARTMENTS_STAT.value === null ? <Skeleton className="h-8 w-10" /> : DEPARTMENTS_STAT.value}
                </div>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-foreground/70">
                <span>{DEPARTMENTS_STAT.label}</span>
                <ArrowUpRightIcon className="size-3 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
              </p>
              <p className="mt-2 text-[11px] text-foreground/70 group-hover:text-primary transition-colors">
                View details →
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}

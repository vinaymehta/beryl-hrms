"use client"

import { UsersIcon, UserPlusIcon, TriangleAlertIcon } from "lucide-react"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmployeeStatusBadge } from "@/features/employees/components/employee-status-badge"
import { EmployeeLevelBadge } from "@/features/employees/components/employee-level-badge"
import { roleBadgeClasses } from "@/constants/permissions"
import type { Employee } from "@/types/employees"
import { API_ORIGIN } from "@/lib/api-client"

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase()
}

// profilePhotoUrl is a path-only Active Storage blob route (served at the
// backend's app root, not under /api/v1).
function photoUrl(path: string | null) {
  if (!path) return undefined
  return `${API_ORIGIN}${path}`
}

/**
 * The head of the reporting chain, plus a flag when the chain is unfinished.
 * Only the primary is shown: three names per row would crowd out everything
 * else, and the full hierarchy is one click away in the detail panel.
 */
function ManagerChainCell({ employee }: { employee: Employee }) {
  // The REVIEW CHAIN only — project managers and the department head are
  // separate relationships and belong on the profile, not in this column.
  const { primary, secondary, final } = employee.managerHierarchy
  const chain = [ primary, secondary, final ].filter(Boolean)

  if (chain.length === 0) {
    return <span className="text-muted-foreground">Not assigned</span>
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="truncate" title={chain.map((person) => person!.fullName).join(" → ")}>
        {primary?.fullName ?? "—"}
      </span>
      {!employee.managerHierarchyComplete && (
        <Badge className="h-5 shrink-0 gap-1 bg-warning/15 px-1.5 text-[11px] text-warning">
          <TriangleAlertIcon className="size-3" />
          Incomplete
        </Badge>
      )}
    </div>
  )
}

// Plain mapped table, not TanStack Table: the list is already paginated/
// filtered server-side, so there's no client-side sort/filter logic here
// that would justify the extra abstraction — see employee-filters.tsx for
// where the actual filtering UI lives. Structure/spacing mirrors the
// Candidates list (recruitment feature) for visual consistency.
export function EmployeeTable({
  employees,
  isLoading,
  isError,
  hasFilters,
  onRetry,
  onSelectEmployee,
  onAddEmployee,
}: {
  employees: Employee[]
  isLoading: boolean
  isError?: boolean
  /** Distinguishes "nothing matched your filters" from "nobody here yet". */
  hasFilters?: boolean
  onRetry?: () => void
  onSelectEmployee: (id: string) => void
  onAddEmployee?: () => void
}) {
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-xl border shadow-2xs">
        <div className="grid gap-px bg-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 bg-card p-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="ml-auto h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="grid gap-3 rounded-xl border border-dashed p-10 text-center">
        <p className="text-sm font-semibold text-foreground">Couldn&apos;t load employees</p>
        <p className="text-xs text-muted-foreground">
          The request didn&apos;t reach the server. Check your connection and try again.
        </p>
        {onRetry && (
          <div>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Try again
            </Button>
          </div>
        )}
      </div>
    )
  }

  if (!employees.length) {
    return (
      <div className="grid justify-items-center gap-2 rounded-xl border border-dashed p-12 text-center">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-role-hr/10 text-role-hr">
          <UsersIcon className="size-5" />
        </span>
        <p className="text-sm font-semibold text-foreground">
          {hasFilters ? "No employees match these filters" : "No employees yet"}
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          {hasFilters
            ? "Try a different department, level or status — or clear the filters to see everyone."
            : "Add your first employee to start building the company directory."}
        </p>
        {!hasFilters && onAddEmployee && (
          <Button size="sm" className="mt-1 gap-1.5" onClick={onAddEmployee}>
            <UserPlusIcon className="size-4" /> Add employee
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="overflow-hidden overflow-x-auto rounded-xl border shadow-2xs">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Job title</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Level</TableHead>
            <TableHead className="hidden lg:table-cell">Primary manager</TableHead>
            <TableHead className="hidden xl:table-cell">Roles</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => (
            <TableRow
              key={employee.id}
              className="cursor-pointer"
              onClick={() => onSelectEmployee(employee.id)}
            >
              <TableCell>
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar size="sm">
                    {employee.profilePhotoUrl && (
                      <AvatarImage src={photoUrl(employee.profilePhotoUrl)} alt={`${employee.firstName} ${employee.lastName}`} />
                    )}
                    <AvatarFallback className="bg-role-hr/12 text-[11px] text-role-hr">
                      {initials(employee.firstName, employee.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{employee.firstName} {employee.lastName}</p>
                    <p className="truncate text-xs text-muted-foreground">{employee.employeeCode}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{employee.designation?.title ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{employee.department?.name ?? "—"}</TableCell>
              <TableCell>
                {employee.currentLevel ? (
                  <EmployeeLevelBadge level={employee.currentLevel} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="hidden max-w-56 text-muted-foreground lg:table-cell">
                <ManagerChainCell employee={employee} />
              </TableCell>
              <TableCell className="hidden xl:table-cell">
                {employee.roles.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {employee.roles.map((role) => (
                      <Badge key={role.id} className={roleBadgeClasses(role.slug)}>
                        {role.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell><EmployeeStatusBadge status={employee.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

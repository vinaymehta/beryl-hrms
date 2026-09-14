"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { EmployeeStatusBadge } from "@/features/employees/components/employee-status-badge"
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

// Plain mapped table, not TanStack Table: the list is already paginated/
// filtered server-side, so there's no client-side sort/filter logic here
// that would justify the extra abstraction — see employee-filters.tsx for
// where the actual filtering UI lives. Structure/spacing mirrors the
// Candidates list (recruitment feature) for visual consistency.
export function EmployeeTable({
  employees,
  isLoading,
  onSelectEmployee,
}: {
  employees: Employee[]
  isLoading: boolean
  onSelectEmployee: (id: string) => void
}) {
  if (isLoading) {
    return (
      <div className="grid gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (!employees.length) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-xs text-muted-foreground space-y-1.5">
        <p className="font-semibold text-foreground text-sm">No employees found</p>
        <p>No employees match these filters.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border shadow-2xs overflow-hidden overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Designation</TableHead>
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
                <div className="flex items-center gap-2.5 min-w-0">
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
              <TableCell className="text-muted-foreground">{employee.department?.name ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{employee.designation?.title ?? "—"}</TableCell>
              <TableCell><EmployeeStatusBadge status={employee.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

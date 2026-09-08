"use client"

import { useRouter } from "next/navigation"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { EmployeeStatusBadge } from "@/features/employees/components/employee-status-badge"
import type { Employee } from "@/types/employees"

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase()
}

// Plain mapped table, not TanStack Table: the list is already paginated/
// filtered server-side, so there's no client-side sort/filter logic here
// that would justify the extra abstraction — see employee-filters.tsx for
// where the actual filtering UI lives.
export function EmployeeTable({
  employees,
  isLoading,
}: {
  employees: Employee[]
  isLoading: boolean
}) {
  const router = useRouter()

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
    return <p className="py-8 text-center text-sm text-muted-foreground">No employees match these filters.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
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
              onClick={() => router.push(`/employees/${employee.id}`)}
            >
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-role-hr/15 text-xs text-role-hr">
                      {initials(employee.firstName, employee.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{employee.firstName} {employee.lastName}</p>
                    <p className="text-xs text-muted-foreground">{employee.employeeCode}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>{employee.department?.name ?? "—"}</TableCell>
              <TableCell>{employee.designation?.title ?? "—"}</TableCell>
              <TableCell><EmployeeStatusBadge status={employee.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

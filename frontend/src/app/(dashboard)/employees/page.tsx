"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon, UsersIcon, UserCheckIcon, Building2Icon, KeyRoundIcon } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { EmployeeTable } from "@/features/employees/components/employee-table"
import { EmployeeFilters } from "@/features/employees/components/employee-filters"
import { EmployeeForm } from "@/features/employees/components/employee-form"
import { useEmployees } from "@/features/employees/hooks/use-employees"
import { useCreateEmployee } from "@/features/employees/hooks/use-employee-mutations"
import { useCurrentUser } from "@/features/auth/hooks/use-current-user"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS, PEOPLE_MANAGEMENT_PERMISSIONS } from "@/constants/permissions"
import type { Employee, EmployeeListParams, EmployeeSortKey } from "@/types/employees"

/** One headline number. Deliberately compact — this is a data tool, not a dashboard. */
function StatTile({
  icon: Icon,
  label,
  value,
  isLoading,
}: {
  icon: LucideIcon
  label: string
  value: number | string
  isLoading: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-2xs">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-role-hr/10 text-role-hr">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        {isLoading ? (
          <Skeleton className="h-6 w-10" />
        ) : (
          <p className="text-xl leading-tight font-semibold tabular-nums">{value}</p>
        )}
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

/**
 * Counted from the CURRENT page of results, and labelled as such — the list
 * endpoint paginates, so claiming these were company-wide totals would be a
 * lie on any company past a page. Only `totalCount` comes from the server.
 */
function pageStats(rows: Employee[]) {
  return {
    active: rows.filter((row) => row.status === "active").length,
    departments: new Set(rows.map((row) => row.department?.id).filter(Boolean)).size,
    withAccess: rows.filter((row) => row.user !== null).length,
  }
}

export default function EmployeesPage() {
  const router = useRouter()
  const { user, isLoading: isUserLoading } = useCurrentUser()
  const managesPeople = usePermission(PEOPLE_MANAGEMENT_PERMISSIONS)

  // /employees is the HR/Admin management list. Someone without those
  // permissions who lands here is looking for their own record, so they get
  // /profile — not /employees/<their id>, which would put an id they could
  // edit into the address bar of the very page this redirect exists to
  // keep them out of.
  const redirectToOwnRecord = !isUserLoading && !!user && !managesPeople && !!user.employeeId

  useEffect(() => {
    if (redirectToOwnRecord) router.replace("/profile")
  }, [redirectToOwnRecord, router])

  // Ten a page, matching EmployeesController::DEFAULT_PER_PAGE. Sent
  // explicitly rather than relied on, so the two can't drift apart silently.
  const [params, setParams] = useState<EmployeeListParams>({ page: 1, perPage: 10 })

  /**
   * Clicking the active column flips the direction; clicking another one
   * starts it ascending. Back to page one either way — page 4 of a list sorted
   * by name is nowhere near page 4 of the same list sorted by status, and
   * staying put would look like the data changed.
   */
  function toggleSort(column: EmployeeSortKey) {
    setParams((current) => ({
      ...current,
      sortBy: column,
      sortDir: current.sortBy === column && current.sortDir === "asc" ? "desc" : "asc",
      page: 1,
    }))
  }
  const [addOpen, setAddOpen] = useState(false)
  const { data, isLoading, isError, refetch } = useEmployees(params)
  const createEmployee = useCreateEmployee()
  const canCreate = usePermission(PERMISSIONS.employeesCreate)

  if (redirectToOwnRecord || (!isUserLoading && !managesPeople)) return null

  const rows = data?.data ?? []
  const stats = pageStats(rows)
  const hasFilters = Boolean(params.q || params.departmentId || params.status)

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-role-hr/12 text-role-hr">
            <UsersIcon className="size-4.5" />
          </span>
          <div>
            <h1 className="text-2xl leading-tight font-semibold tracking-tight">Employees</h1>
            <p className="text-xs text-muted-foreground">
              Profiles, job titles, reporting managers and system access.
            </p>
          </div>
        </div>
        {canCreate && (
          <Button onClick={() => setAddOpen(true)}>
            <PlusIcon /> Add employee
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={UsersIcon}
          label="Employees in total"
          value={data?.meta.totalCount ?? 0}
          isLoading={isLoading}
        />
        <StatTile icon={UserCheckIcon} label="Active on this page" value={stats.active} isLoading={isLoading} />
        <StatTile
          icon={Building2Icon}
          label="Departments on this page"
          value={stats.departments}
          isLoading={isLoading}
        />
        <StatTile
          icon={KeyRoundIcon}
          label="With a login on this page"
          value={stats.withAccess}
          isLoading={isLoading}
        />
      </div>

      <EmployeeFilters params={params} onChange={setParams} />

      <EmployeeTable
        employees={rows}
        isLoading={isLoading}
        isError={isError}
        hasFilters={hasFilters}
        onRetry={() => refetch()}
        onSelectEmployee={(employeeId) => router.push(`/employees/${employeeId}`)}
        onAddEmployee={canCreate ? () => setAddOpen(true) : undefined}
        sort={{ by: params.sortBy, dir: params.sortDir ?? "asc" }}
        onSort={toggleSort}
      />

      {/* Always shown, not only past one page: the rows-per-page control is
          how you get MORE than one page in the first place, so hiding it while
          there is only one is exactly when it is wanted. */}
      {data && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <label htmlFor="employees-per-page" className="text-xs">
              Rows per page
            </label>
            <select
              id="employees-per-page"
              className="h-8 rounded-md border bg-background px-2 text-xs"
              value={params.perPage ?? 10}
              onChange={(e) => setParams({ ...params, perPage: Number(e.target.value), page: 1 })}
            >
              {[ 10, 25, 50, 100 ].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs">
            Page {data.meta.page} of {Math.max(data.meta.totalPages, 1)} · {data.meta.totalCount} employees
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              aria-label="Previous page"
              disabled={data.meta.page <= 1}
              onClick={() => setParams({ ...params, page: data.meta.page - 1 })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label="Next page"
              disabled={data.meta.page >= data.meta.totalPages}
              onClick={() => setParams({ ...params, page: data.meta.page + 1 })}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="right" className="w-full p-0 flex flex-col gap-0 sm:w-[45vw] sm:min-w-180 sm:max-w-275">
          <SheetHeader className="border-b bg-role-hr/5 pr-14">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-role-hr/12 text-role-hr">
                <PlusIcon className="size-5" />
              </span>
              <div>
                <SheetTitle className="text-lg">Add employee</SheetTitle>
                <SheetDescription>
                  Create the profile, set their reporting managers, and optionally invite them to sign in.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
          {/* Muted backdrop so the white section cards read as distinct panels
              rather than merging into one long sheet. */}
          <div className="flex-1 overflow-y-auto bg-muted/30 p-4">
            <EmployeeForm
              isPending={createEmployee.isPending}
              onSubmit={(values) =>
                createEmployee.mutate(values, { onSuccess: () => setAddOpen(false) })
              }
            />
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 border-t bg-background p-4 shadow-[0_-1px_8px_rgba(0,0,0,0.04)]">
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="employee-form"
              disabled={createEmployee.isPending}
              className="gap-1.5 bg-role-hr text-role-hr-foreground hover:bg-role-hr/90 shadow-2xs"
            >
              <PlusIcon className="size-4" />
              {createEmployee.isPending ? "Adding…" : "Add employee"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

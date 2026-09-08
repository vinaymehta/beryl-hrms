"use client"

import { useState } from "react"
import { PlusIcon, UsersIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
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
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@/constants/permissions"
import type { EmployeeListParams } from "@/types/employees"

export default function EmployeesPage() {
  const [params, setParams] = useState<EmployeeListParams>({ page: 1 })
  const [addOpen, setAddOpen] = useState(false)
  const { data, isLoading } = useEmployees(params)
  const createEmployee = useCreateEmployee()
  const canCreate = usePermission(PERMISSIONS.employeesCreate)

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-role-hr/12 text-role-hr">
            <UsersIcon className="size-4.5" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
        </div>
        {canCreate && (
          <Button onClick={() => setAddOpen(true)}>
            <PlusIcon /> Add employee
          </Button>
        )}
      </div>

      <EmployeeFilters params={params} onChange={setParams} />

      <EmployeeTable employees={data?.data ?? []} isLoading={isLoading} />

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.meta.page} of {data.meta.totalPages} · {data.meta.totalCount} employees
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.meta.page <= 1}
              onClick={() => setParams({ ...params, page: data.meta.page - 1 })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.meta.page >= data.meta.totalPages}
              onClick={() => setParams({ ...params, page: data.meta.page + 1 })}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Add employee</SheetTitle>
            <SheetDescription>Create a new employee profile for your company.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <EmployeeForm
              isPending={createEmployee.isPending}
              onSubmit={(values) =>
                createEmployee.mutate(values, { onSuccess: () => setAddOpen(false) })
              }
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

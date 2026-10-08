"use client"

import { PencilIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PanelBody, PanelFooter, PanelHeader } from "@/components/ui/panel"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { EmployeeForm } from "@/features/employees/components/employee-form"
import { useUpdateEmployee } from "@/features/employees/hooks/use-employee-mutations"
import { useEmployee } from "@/features/employees/hooks/use-employees"

/**
 * Edit employee, in the side panel — opened from the employee's page and from
 * the Edit action in the employee list. Reads the full record itself, so a
 * list row (which carries less) is never what the form is filled from.
 */
export function EditEmployeeSheet({
  employeeId,
  open,
  onOpenChange,
}: {
  employeeId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: employee, isLoading } = useEmployee(employeeId)
  const updateEmployee = useUpdateEmployee(employeeId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:w-[45vw] sm:max-w-275 sm:min-w-180"
      >
        <PanelHeader
          icon={PencilIcon}
          title="Edit employee"
          description={
            employee ? (
              <>Update {employee.firstName}&apos;s profile, reporting managers and access.</>
            ) : (
              "Update the profile, reporting managers and access."
            )
          }
        />
        <PanelBody>
          {isLoading || !employee ? (
            <div className="grid gap-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <EmployeeForm
              employee={employee}
              isPending={updateEmployee.isPending}
              onSubmit={(values) =>
                updateEmployee.mutate(values, { onSuccess: () => onOpenChange(false) })
              }
            />
          )}
        </PanelBody>
        <PanelFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="employee-form"
            disabled={updateEmployee.isPending || !employee}
            className="gap-1.5 bg-role-hr text-role-hr-foreground shadow-2xs hover:bg-role-hr/90"
          >
            <PencilIcon className="size-4" />
            {updateEmployee.isPending ? "Saving…" : "Save changes"}
          </Button>
        </PanelFooter>
      </SheetContent>
    </Sheet>
  )
}

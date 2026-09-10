"use client"

import { useState } from "react"
import { PencilIcon, UserMinusIcon, UserCheckIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { EmployeeStatusBadge } from "@/features/employees/components/employee-status-badge"
import { EmployeeForm } from "@/features/employees/components/employee-form"
import { useEmployee } from "@/features/employees/hooks/use-employees"
import { useUpdateEmployee, useDeactivateEmployee } from "@/features/employees/hooks/use-employee-mutations"

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase()
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid gap-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  )
}

/**
 * The employee profile body — shared by the standalone /employees/[id]
 * route and the right-side detail panel opened from the employee list, so
 * both render identically and stay in sync automatically.
 */
export function EmployeeDetailContent({ employeeId }: { employeeId: string }) {
  const { data: employee, isLoading } = useEmployee(employeeId)
  const updateEmployee = useUpdateEmployee(employeeId)
  const deactivateEmployee = useDeactivateEmployee()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (isLoading || !employee) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <Card className="overflow-hidden border-none bg-gradient-to-br from-role-hr to-role-hr/70 text-white">
        {/* flex-wrap: this header is reused both full-width (the standalone
            /employees/[id] page) and inside the narrower right-side panel —
            the action buttons need to drop to their own line rather than
            clip when the container is a ~640px sheet, not the full page. */}
        <CardContent className="flex flex-wrap items-center gap-4 p-5 justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="size-16 border-2 border-white/30">
              <AvatarFallback className="bg-white/15 text-lg text-white">
                {initials(employee.firstName, employee.lastName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl font-semibold">{employee.firstName} {employee.lastName}</h1>
              <p className="text-sm text-white/80">
                {employee.designation?.title ?? "No designation"} · {employee.department?.name ?? "No department"}
              </p>
              <div className="mt-1.5"><EmployeeStatusBadge status={employee.status} /></div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="bg-white/10 text-white hover:bg-white/20" onClick={() => setEditOpen(true)}>
              <PencilIcon /> Edit
            </Button>
            {employee.status === "active" ? (
              <Button variant="outline" className="bg-white/10 text-white hover:bg-white/20" onClick={() => setConfirmOpen(true)}>
                <UserMinusIcon /> Deactivate
              </Button>
            ) : (
              <Button
                variant="outline"
                className="bg-white/10 text-white hover:bg-white/20"
                onClick={() => deactivateEmployee.mutate(employee.id)}
              >
                <UserCheckIcon /> Reactivate
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Personal information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <InfoRow label="Date of birth" value={employee.dateOfBirth} />
            <InfoRow label="Gender" value={employee.gender} />
            <InfoRow label="Phone" value={employee.phone} />
            <InfoRow label="Personal email" value={employee.personalEmail} />
            <div className="col-span-2">
              <InfoRow
                label="Address"
                value={[employee.addressLine1, employee.city, employee.state, employee.postalCode, employee.country]
                  .filter(Boolean)
                  .join(", ") || null}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Employment</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <InfoRow label="Employee code" value={employee.employeeCode} />
            <InfoRow label="Date of joining" value={employee.dateOfJoining} />
            <InfoRow label="Department" value={employee.department?.name ?? null} />
            <InfoRow label="Designation" value={employee.designation?.title ?? null} />
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader><CardTitle className="text-base">Emergency contact</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <InfoRow label="Name" value={employee.emergencyContactName} />
            <InfoRow label="Phone" value={employee.emergencyContactPhone} />
          </CardContent>
        </Card>
      </div>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-full p-0 flex flex-col gap-0 sm:w-[45vw] sm:min-w-180 sm:max-w-275">
          <SheetHeader className="border-b bg-role-hr/5 pr-14">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-role-hr/12 text-role-hr">
                <PencilIcon className="size-5" />
              </span>
              <div>
                <SheetTitle className="text-lg">Edit Employee</SheetTitle>
                <SheetDescription>Update {employee.firstName}&apos;s profile.</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <EmployeeForm
              employee={employee}
              isPending={updateEmployee.isPending}
              onSubmit={(values) => updateEmployee.mutate(values, { onSuccess: () => setEditOpen(false) })}
            />
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 border-t bg-background p-4">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="employee-form" disabled={updateEmployee.isPending} className="gap-1.5">
              <PencilIcon className="size-4" />
              {updateEmployee.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate {employee.firstName} {employee.lastName}?</DialogTitle>
            <DialogDescription>
              Their profile and history are kept, not deleted — they can be reactivated later. This does not delete
              any records, per the platform&apos;s data-retention policy.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              variant="destructive"
              disabled={deactivateEmployee.isPending}
              onClick={() =>
                deactivateEmployee.mutate(employee.id, { onSuccess: () => setConfirmOpen(false) })
              }
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

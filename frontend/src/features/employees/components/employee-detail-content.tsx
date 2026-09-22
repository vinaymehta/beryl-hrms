"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  PencilIcon,
  UserMinusIcon,
  UserCheckIcon,
  NetworkIcon,
  KeyRoundIcon,
  BriefcaseIcon,
  UserIcon,
  ShieldAlertIcon,
  MailIcon,
  PhoneIcon,
  CalendarDaysIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { API_ORIGIN } from "@/lib/api-client"
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
import { ManagerHierarchyCard } from "@/features/employees/components/manager-hierarchy-card"
import { EmployeeRecordTabs } from "@/features/employees/components/employee-record-tabs"
import { EmployeeLevelBadge } from "@/features/employees/components/employee-level-badge"
import { EmployeeForm } from "@/features/employees/components/employee-form"
import { useEmployee } from "@/features/employees/hooks/use-employees"
import { useUpdateEmployee, useDeactivateEmployee, useReactivateEmployee } from "@/features/employees/hooks/use-employee-mutations"
import { EmployeeDocumentsSection } from "@/features/documents/components/employee-documents-section"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS, PEOPLE_MANAGEMENT_PERMISSIONS, roleBadgeClasses } from "@/constants/permissions"

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase()
}

// profilePhotoUrl is a path-only Active Storage blob route (Rails serves it
// at the app root, not under /api/v1), so it needs the backend origin
// prefixed the same way recruitmentApi.resumes.downloadUrl does.
function photoUrl(path: string | null) {
  if (!path) return undefined
  return `${API_ORIGIN}${path}`
}

function InfoRow({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: LucideIcon }) {
  return (
    <div className="grid gap-0.5">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </p>
      <div className="text-sm font-medium">{value || "—"}</div>
    </div>
  )
}

function SectionCard({
  icon: Icon,
  title,
  action,
  className,
  children,
}: {
  icon: LucideIcon
  title: string
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-role-hr/12 text-role-hr">
            <Icon className="size-3.5" />
          </span>
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
      {children}
    </p>
  )
}

export interface EmployeeDetailContentProps {
  employeeId: string
  onBack?: () => void
  showBackButton?: boolean
  backLabel?: string
}

/**
 * The employee profile body — shared by the standalone /employees/[id]
 * route and any embedded employee detail views.
 */
export function EmployeeDetailContent({
  employeeId,
  onBack,
  showBackButton,
  backLabel = "Back to employees",
}: EmployeeDetailContentProps) {
  const router = useRouter()
  const managesPeople = usePermission(PEOPLE_MANAGEMENT_PERMISSIONS)
  const showBack = showBackButton !== undefined ? showBackButton : Boolean(managesPeople)

  const handleBack = () => {
    if (onBack) {
      onBack()
      return
    }
    router.push("/employees")
  }

  const { data: employee, isLoading, isError, refetch } = useEmployee(employeeId)
  const updateEmployee = useUpdateEmployee(employeeId)
  const deactivateEmployee = useDeactivateEmployee()
  const reactivateEmployee = useReactivateEmployee()
  const canUpdate = usePermission(PERMISSIONS.employeesUpdate)
  const canDeactivate = usePermission(PERMISSIONS.employeesDelete)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="grid gap-4">
        {showBack && (
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-36 rounded-lg" />
          </div>
        )}
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  if (isError || !employee) {
    return (
      <div className="grid gap-4">
        {showBack && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs font-medium shadow-2xs hover:bg-muted/80"
              onClick={handleBack}
            >
              <ArrowLeftIcon className="size-4" />
              {backLabel}
            </Button>
          </div>
        )}
        <div className="grid gap-3 rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm font-semibold text-foreground">Couldn&apos;t load this employee</p>
          <p className="text-xs text-muted-foreground">
            The record may have been removed, or the request didn&apos;t reach the server.
          </p>
          <div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {showBack && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs font-medium shadow-2xs hover:bg-muted/80"
            onClick={handleBack}
          >
            <ArrowLeftIcon className="size-4" />
            {backLabel}
          </Button>
        </div>
      )}

      <Card className="overflow-hidden border-none bg-gradient-to-br from-role-hr to-role-hr/70 text-white">
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <Avatar className="size-16 border-2 border-white/30">
            {employee.profilePhotoUrl && (
              <AvatarImage src={photoUrl(employee.profilePhotoUrl)} alt={`${employee.firstName} ${employee.lastName}`} />
            )}
            <AvatarFallback className="bg-white/15 text-lg text-white">
              {initials(employee.firstName, employee.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold">
              {employee.firstName} {employee.lastName}
            </h1>
            <p className="truncate text-sm text-white/80">
              {employee.designation?.title ?? "No job title"} · {employee.department?.name ?? "No department"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <EmployeeStatusBadge
                status={employee.status}
                className="border border-white/25 bg-white/15 text-white"
              />
              <EmployeeLevelBadge
                level={employee.currentLevel}
                className="border border-white/25 bg-white/15 text-white"
              />
              {employee.roles.map((role) => (
                <Badge key={role.id} className="border border-white/25 bg-white/15 text-white">
                  {role.name}
                </Badge>
              ))}
            </div>
          </div>
          <div className="text-right text-xs text-white/75">
            <p className="font-mono text-sm font-semibold text-white">{employee.employeeCode}</p>
            <p>Employee ID</p>
          </div>
        </CardContent>
      </Card>

      <EmployeeRecordTabs
        employeeId={employeeId}
        documents={<EmployeeDocumentsSection employeeId={employeeId} />}
        overview={
          <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard icon={BriefcaseIcon} title="Employment">
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Employee ID" value={employee.employeeCode} />
            <InfoRow label="Date of joining" value={employee.dateOfJoining} icon={CalendarDaysIcon} />
            <InfoRow label="Department" value={employee.department?.name ?? null} />
            <InfoRow label="Job title" value={employee.designation?.title ?? null} />
            <InfoRow
              label="Current role / level"
              value={employee.currentLevel ? <EmployeeLevelBadge level={employee.currentLevel} /> : null}
            />
            <InfoRow label="Status" value={<EmployeeStatusBadge status={employee.status} />} />
          </div>
        </SectionCard>

        <SectionCard icon={NetworkIcon} title="Reporting manager">
          <ManagerHierarchyCard employee={employee} />
        </SectionCard>

        <SectionCard icon={KeyRoundIcon} title="System access">
          {employee.user ? (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Work email" value={employee.user.email} icon={MailIcon} />
                <InfoRow
                  label="Account"
                  value={
                    <Badge
                      className={
                        employee.user.status === "active"
                          ? "bg-success/15 text-success"
                          : employee.user.status === "invited"
                            ? "bg-warning/15 text-warning"
                            : "bg-muted text-muted-foreground"
                      }
                    >
                      {employee.user.status === "invited" ? "Invite sent" : employee.user.status}
                    </Badge>
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <p className="text-xs text-muted-foreground">Roles</p>
                <div className="flex flex-wrap gap-1.5">
                  {employee.roles.map((role) => (
                    <Badge key={role.id} className={roleBadgeClasses(role.slug)}>
                      {role.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <EmptyHint>
              No login account. Add a work email from Edit to invite them — they set their own password.
            </EmptyHint>
          )}
        </SectionCard>

        <SectionCard icon={UserIcon} title="Personal information">
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Date of birth" value={employee.dateOfBirth} />
            <InfoRow label="Gender" value={employee.gender} />
            <InfoRow label="Phone" value={employee.phone} icon={PhoneIcon} />
            <InfoRow label="Personal email" value={employee.personalEmail} icon={MailIcon} />
            <div className="col-span-2 grid grid-cols-2 gap-4 border-t pt-4">
              <div className="col-span-2">
                <InfoRow label="Street address" value={employee.addressLine1} />
              </div>
              {employee.addressLine2 && (
                <div className="col-span-2">
                  <InfoRow label="Address line 2" value={employee.addressLine2} />
                </div>
              )}
              <InfoRow label="City" value={employee.city} />
              <InfoRow label="State" value={employee.state} />
              <InfoRow label="Postal code" value={employee.postalCode} />
              <InfoRow label="Country" value={employee.country} />
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={ShieldAlertIcon} title="Emergency contact" className="sm:col-span-2">
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Name" value={employee.emergencyContactName} />
            <InfoRow label="Phone" value={employee.emergencyContactPhone} icon={PhoneIcon} />
          </div>
        </SectionCard>

          </div>
        }
      />

      {/* Sticky bottom action bar — matches the Edit/Add Employee sheets'
          footer convention instead of living in the header, where it used
          to clip in the narrower right-side panel. Hidden entirely for a
          viewer who can do neither thing, rather than offering buttons the
          API would refuse. */}
      {(canUpdate || canDeactivate) && (
        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 rounded-xl border bg-background p-3 shadow-[0_-1px_8px_rgba(0,0,0,0.06)]">
          {canUpdate && (
            <Button variant="outline" className="gap-1.5" onClick={() => setEditOpen(true)}>
              <PencilIcon className="size-4" /> Edit
            </Button>
          )}
          {canDeactivate &&
            (employee.status === "active" ? (
              <Button
                variant="outline"
                className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <UserMinusIcon className="size-4" /> Deactivate
              </Button>
            ) : (
              <Button
                className="gap-1.5 bg-role-hr text-role-hr-foreground hover:bg-role-hr/90 shadow-2xs"
                disabled={reactivateEmployee.isPending}
                onClick={() => reactivateEmployee.mutate(employee.id)}
              >
                <UserCheckIcon className="size-4" /> Reactivate
              </Button>
            ))}
        </div>
      )}

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-full p-0 flex flex-col gap-0 sm:w-[45vw] sm:min-w-180 sm:max-w-275">
          <SheetHeader className="border-b bg-role-hr/5 pr-14">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-role-hr/12 text-role-hr">
                <PencilIcon className="size-5" />
              </span>
              <div>
                <SheetTitle className="text-lg">Edit employee</SheetTitle>
                <SheetDescription>Update {employee.firstName}&apos;s profile, reporting managers and access.</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto bg-muted/30 p-4">
            <EmployeeForm
              employee={employee}
              isPending={updateEmployee.isPending}
              onSubmit={(values) => updateEmployee.mutate(values, { onSuccess: () => setEditOpen(false) })}
            />
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 border-t bg-background p-4 shadow-[0_-1px_8px_rgba(0,0,0,0.04)]">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="employee-form"
              disabled={updateEmployee.isPending}
              className="gap-1.5 bg-role-hr text-role-hr-foreground hover:bg-role-hr/90 shadow-2xs"
            >
              <PencilIcon className="size-4" />
              {updateEmployee.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UsersIcon className="size-4 text-destructive" />
              Deactivate {employee.firstName} {employee.lastName}?
            </DialogTitle>
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

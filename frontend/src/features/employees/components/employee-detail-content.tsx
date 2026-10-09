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
  LandmarkIcon,
  IdCardIcon,
  UserPenIcon,
  MapPinIcon,
  HashIcon,
  CircleCheckIcon,
  type LucideIcon,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { API_ORIGIN } from "@/lib/api-client"
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
import { EditEmployeeSheet } from "@/features/employees/components/edit-employee-sheet"
import { EditProfileSheet } from "@/features/employees/components/edit-profile-sheet"
import {
  SensitiveValue,
  formatAadhaar,
  hasSensitiveDetails,
  maskAadhaar,
  maskTail,
} from "@/features/employees/components/sensitive-field"
import { AccountAccess } from "@/features/employees/components/account-access"
import { useEmployee } from "@/features/employees/hooks/use-employees"
import { useDeactivateEmployee, useReactivateEmployee } from "@/features/employees/hooks/use-employee-mutations"
import { EmployeeDocumentsSection } from "@/features/documents/components/employee-documents-section"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS, PEOPLE_MANAGEMENT_PERMISSIONS } from "@/constants/permissions"

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
    <div className="grid min-w-0 gap-1">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </p>
      <div className="min-w-0 break-words text-sm font-medium text-foreground">
        {value || <span className="text-muted-foreground/50">—</span>}
      </div>
    </div>
  )
}

/** "2025-09-10" → "10 Sep 2025". */
function formatDate(iso: string | null) {
  if (!iso) return null
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

/** Time at the company since the joining date: "1 yr 1 mo", "3 mo", "Joins in 5 days". */
function tenure(iso: string | null) {
  if (!iso) return null
  const start = new Date(`${iso.slice(0, 10)}T00:00:00`)
  const now = new Date()
  if (Number.isNaN(start.getTime())) return null
  if (start > now) {
    const days = Math.ceil((start.getTime() - now.getTime()) / 86_400_000)
    return `Joins in ${days} day${days === 1 ? "" : "s"}`
  }
  let months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth()
  if (now.getDate() < start.getDate()) months -= 1
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (years === 0 && rest === 0) return "Joined this month"
  return [years && `${years} yr`, rest && `${rest} mo`].filter(Boolean).join(" ")
}

/** One fact in the header strip (light text on the coloured header). */
function HeaderFact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-white/65">{label}</p>
        <div className="truncate text-sm font-medium text-white">{value || <span className="text-white/50">—</span>}</div>
      </div>
    </div>
  )
}

/** How much of the record is filled in, with what is still missing. */
function ProfileCompleteness({ employee }: { employee: NonNullable<ReturnType<typeof useEmployee>["data"]> }) {
  const checks: [string, boolean][] = [
    ["Photo", !!employee.profilePhotoUrl],
    ["Department", !!employee.department],
    ["Designation", !!employee.designation],
    ["Date of joining", !!employee.dateOfJoining],
    ["Phone", employee.phones.length > 0],
    ["Personal email", !!employee.personalEmail],
    ["Date of birth", !!employee.dateOfBirth],
    ["Gender", !!employee.gender],
    ["Address", !!employee.addressLine1 && !!employee.city],
    ["Emergency contact", employee.emergencyContacts.length > 0],
    ["Reporting manager", employee.managerHierarchyComplete],
  ]
  if (hasSensitiveDetails(employee)) {
    checks.push(["Bank details", !!employee.bankAccountNumber], ["Aadhaar", !!employee.aadhaarNumber], ["PAN", !!employee.panNumber])
  }
  const done = checks.filter(([, ok]) => ok).length
  const percent = Math.round((done / checks.length) * 100)
  const missing = checks.filter(([, ok]) => !ok).map(([label]) => label)

  return (
    <SectionCard icon={CircleCheckIcon} title="Profile completeness">
      <div className="grid gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-semibold tabular-nums text-foreground">{percent}%</span>
          <span className="text-xs text-muted-foreground">{done} of {checks.length} filled in</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full rounded-full ${percent === 100 ? "bg-success" : "bg-role-hr"}`} style={{ width: `${percent}%` }} />
        </div>
        {missing.length > 0 ? (
          <div className="grid gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Missing</p>
            <div className="flex flex-wrap gap-1.5">
              {missing.map((label) => (
                <span key={label} className="rounded-md border border-dashed px-2 py-0.5 text-xs text-muted-foreground">{label}</span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-success">Everything is filled in.</p>
        )}
      </div>
    </SectionCard>
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
  /**
   * The viewer's OWN profile (the /profile page): offers "Edit profile", the
   * employee's self-service edit of their personal details. The server checks
   * the record really is theirs regardless — this only decides the button.
   */
  selfService?: boolean
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
  selfService = false,
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
  const deactivateEmployee = useDeactivateEmployee()
  const reactivateEmployee = useReactivateEmployee()
  const canUpdate = usePermission(PERMISSIONS.employeesUpdate)
  const canDeactivate = usePermission(PERMISSIONS.employeesDelete)
  // Inviting somebody and resetting their password ride on the same right as
  // giving them a login in the first place — see EmployeePolicy.
  const canManageRoles = usePermission(PERMISSIONS.employeesManageRoles)
  const [editOpen, setEditOpen] = useState(false)
  const [profileEditOpen, setProfileEditOpen] = useState(false)
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
      {/* Back on the left, the record's actions on the right — above the
          header ribbon, so they are in reach without scrolling. Actions are
          hidden entirely for a viewer who can do neither thing, rather than
          offering buttons the API would refuse. */}
      {(showBack || selfService || canUpdate || canDeactivate) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {showBack ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs font-medium shadow-2xs hover:bg-muted/80"
              onClick={handleBack}
            >
              <ArrowLeftIcon className="size-4" />
              {backLabel}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {selfService && (
              <Button
                className="gap-1.5 bg-role-hr text-role-hr-foreground shadow-2xs hover:bg-role-hr/90"
                onClick={() => setProfileEditOpen(true)}
              >
                <UserPenIcon className="size-4" /> Edit profile
              </Button>
            )}
            {/* On your own profile only the self-service edit: the full Edit and Deactivate (admin/HR) are on the
                Employees page, so an admin is never offered to deactivate their own account from here. */}
            {canUpdate && !selfService && (
              <Button variant="outline" className="gap-1.5" onClick={() => setEditOpen(true)}>
                <PencilIcon className="size-4" /> Edit
              </Button>
            )}
            {canDeactivate && !selfService &&
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
        </div>
      )}

      <Card className="overflow-hidden border-none bg-gradient-to-br from-role-hr to-role-hr/70 p-0 text-white shadow-md">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center gap-5 p-6">
            <Avatar className="size-20 border-4 border-white/25 shadow-lg">
              {employee.profilePhotoUrl && (
                <AvatarImage src={photoUrl(employee.profilePhotoUrl)} alt={`${employee.firstName} ${employee.lastName}`} />
              )}
              <AvatarFallback className="bg-white/15 text-2xl text-white">
                {initials(employee.firstName, employee.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-semibold tracking-tight">
                {employee.firstName} {employee.lastName}
              </h1>
              <p className="mt-0.5 truncate text-sm text-white/80">
                {employee.designation?.title ?? "No designation"} · {employee.department?.name ?? "No department"}
                {employee.employmentTypeName && ` · ${employee.employmentTypeName}`}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <EmployeeStatusBadge status={employee.status} className="border border-white/25 bg-white/15 text-white" />
                {employee.roles.map((role) => (
                  <Badge key={role.id} className="border border-white/25 bg-white/15 text-white">
                    {role.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          {/* Key facts at a glance, so the most-asked questions are answered before scrolling. */}
          <div className="grid gap-4 border-t border-white/15 bg-black/10 px-6 py-4 sm:grid-cols-2 xl:grid-cols-5">
            <HeaderFact icon={HashIcon} label="Employee ID" value={<span className="font-mono">{employee.employeeCode}</span>} />
            <HeaderFact
              icon={CalendarDaysIcon}
              label="Joined"
              value={employee.dateOfJoining && `${formatDate(employee.dateOfJoining)} · ${tenure(employee.dateOfJoining)}`}
            />
            <HeaderFact icon={MailIcon} label="Work email" value={employee.user?.email} />
            <HeaderFact icon={PhoneIcon} label="Phone" value={employee.phones[0]} />
            <HeaderFact
              icon={MapPinIcon}
              label="Location"
              value={employee.workLocation ?? ([employee.city, employee.state].filter(Boolean).join(", ") || null)}
            />
          </div>
        </CardContent>
      </Card>

      <EmployeeRecordTabs
        employeeId={employeeId}
        documents={<EmployeeDocumentsSection employeeId={employeeId} />}
        overview={
          <div className="grid gap-4 xl:grid-cols-3">
            {/* The record itself, in reading order. */}
            <div className="grid content-start gap-4 xl:col-span-2">
              <SectionCard icon={BriefcaseIcon} title="Employment">
                <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                  <InfoRow label="Employee ID" value={employee.employeeCode} />
                  <InfoRow
                    label="Date of joining"
                    icon={CalendarDaysIcon}
                    value={employee.dateOfJoining && (
                      <span>
                        {formatDate(employee.dateOfJoining)}
                        <span className="block text-xs font-normal text-muted-foreground">{tenure(employee.dateOfJoining)}</span>
                      </span>
                    )}
                  />
                  <InfoRow label="Status" value={<EmployeeStatusBadge status={employee.status} />} />
                  <InfoRow label="Department" value={employee.department?.name ?? null} />
                  <InfoRow label="Designation" value={employee.designation?.title ?? null} />
                  <InfoRow label="Employment type" value={employee.employmentTypeName} />
                  <InfoRow label="Work location" value={employee.workLocation} icon={MapPinIcon} />
                  <InfoRow label="Level" value={employee.currentLevel && <span className="capitalize">{employee.currentLevel}</span>} />
                </div>
              </SectionCard>

              <SectionCard icon={UserIcon} title="Personal information">
                <div className="grid gap-5">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                    <InfoRow label="Date of birth" value={formatDate(employee.dateOfBirth)} icon={CalendarDaysIcon} />
                    <InfoRow label="Celebration date" value={formatDate(employee.celebrationDate)} icon={CalendarDaysIcon} />
                    <InfoRow label="Gender" value={employee.gender && <span className="capitalize">{employee.gender}</span>} />
                    <InfoRow label="Personal email" value={employee.personalEmail} icon={MailIcon} />
                    <InfoRow
                      label={employee.phones.length > 1 ? "Phone numbers" : "Phone"}
                      icon={PhoneIcon}
                      value={
                        employee.phones.length > 0 && (
                          <ul className="grid gap-0.5">
                            {employee.phones.map((phone, index) => (
                              <li key={phone} className="flex items-center gap-2">
                                {phone}
                                {index === 0 && employee.phones.length > 1 && (
                                  <Badge variant="outline" className="text-[10px]">Main</Badge>
                                )}
                              </li>
                            ))}
                          </ul>
                        )
                      }
                    />
                  </div>
                  <div className="grid gap-x-6 gap-y-5 rounded-xl bg-muted/40 p-4 sm:grid-cols-3">
                    <div className="sm:col-span-3">
                      <InfoRow
                        label="Address"
                        icon={MapPinIcon}
                        value={[employee.addressLine1, employee.addressLine2].filter(Boolean).join(", ") || null}
                      />
                    </div>
                    <InfoRow label="City" value={employee.city} />
                    <InfoRow label="State" value={employee.state} />
                    <InfoRow label="Postal code" value={employee.postalCode} />
                    <InfoRow label="Country" value={employee.country} />
                  </div>
                </div>
              </SectionCard>

              <SectionCard icon={ShieldAlertIcon} title="Emergency contacts">
                {employee.emergencyContacts.length === 0 ? (
                  <EmptyHint>No emergency contacts on file.</EmptyHint>
                ) : (
                  <ul className="divide-y rounded-xl border">
                    {employee.emergencyContacts.map((contact, index) => (
                      <li key={index} className="grid grid-cols-3 gap-4 px-4 py-3">
                        <InfoRow label="Name" value={contact.name} />
                        <InfoRow label="Relationship" value={contact.relation && <span className="capitalize">{contact.relation}</span>} />
                        <InfoRow label="Phone" value={contact.phone} icon={PhoneIcon} />
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              {/* Present in the response only for the employee themselves and
                  Admin/HR — anyone else never receives the keys, so the cards
                  simply aren't drawn. Masked until revealed, either way. */}
              {hasSensitiveDetails(employee) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <SectionCard icon={LandmarkIcon} title="Bank details">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                      <div className="col-span-2">
                        <InfoRow label="Account holder name" value={employee.bankAccountHolderName} />
                      </div>
                      <InfoRow
                        label="Account number"
                        value={<SensitiveValue value={employee.bankAccountNumber} label="account number" mask={maskTail} />}
                      />
                      <InfoRow
                        label="IFSC code"
                        value={employee.bankIfscCode && <span className="font-mono tracking-wide">{employee.bankIfscCode}</span>}
                      />
                    </div>
                  </SectionCard>

                  <SectionCard icon={IdCardIcon} title="Identity numbers">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                      <InfoRow
                        label="Aadhaar number"
                        value={
                          <SensitiveValue
                            value={employee.aadhaarNumber}
                            label="Aadhaar number"
                            mask={maskAadhaar}
                            format={formatAadhaar}
                          />
                        }
                      />
                      <InfoRow
                        label="PAN number"
                        value={<SensitiveValue value={employee.panNumber} label="PAN number" mask={maskTail} />}
                      />
                      {(employee.otherIdentityNumbers ?? []).map((doc, index) => (
                        <InfoRow
                          key={`${doc.label}-${index}`}
                          label={doc.label}
                          value={<SensitiveValue value={doc.number} label={doc.label} mask={maskTail} />}
                        />
                      ))}
                    </div>
                  </SectionCard>
                </div>
              )}
            </div>

            {/* At-a-glance side column: how complete the record is, who they report to, and their login. */}
            <div className="grid content-start gap-4">
              <ProfileCompleteness employee={employee} />

              <SectionCard icon={NetworkIcon} title="Reporting manager">
                <ManagerHierarchyCard employee={employee} />
              </SectionCard>

              <SectionCard icon={KeyRoundIcon} title="System access">
                <AccountAccess employee={employee} canManage={canManageRoles} />
              </SectionCard>
            </div>
          </div>
        }
      />

      <EditEmployeeSheet employeeId={employeeId} open={editOpen} onOpenChange={setEditOpen} />
      {selfService && (
        <EditProfileSheet employee={employee} open={profileEditOpen} onOpenChange={setProfileEditOpen} />
      )}

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

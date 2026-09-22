"use client"

import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  UserIcon,
  BriefcaseIcon,
  PhoneIcon,
  MapPinIcon,
  ShieldAlertIcon,
  NetworkIcon,
  KeyRoundIcon,
  InfoIcon,
  LockIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "cn"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select"
import { SearchSelect } from "@/components/ui/search-select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { employeeFormSchema, type EmployeeFormValues, type EmployeePayload } from "@/features/employees/schemas"
import {
  useDepartments,
  useDesignations,
  useAssignableManagers,
  useRoles,
} from "@/features/employees/hooks/use-employees"
import {
  EMPLOYEE_LEVELS,
  GENDER_OPTIONS,
  DEFAULT_EMPLOYEE_ROLE_SLUG,
  MANAGER_LEVELS,
  ADDITIONAL_MANAGER_RELATIONSHIPS,
  EMPLOYMENT_TYPES,
} from "@/features/employees/constants"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS, roleBadgeClasses } from "@/constants/permissions"
import { API_ORIGIN } from "@/lib/api-client"
import type { Employee, EmployeeSummary, ReviewChainLevel } from "@/types/employees"

function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

function photoUrl(path: string | null) {
  return path ? `${API_ORIGIN}${path}` : undefined
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon
  title: string
  subtitle: string
}) {
  return (
    <div className="flex items-start gap-2.5 border-b px-4 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-role-hr/12 text-role-hr">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm leading-tight font-semibold text-foreground">{title}</h3>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  )
}

/**
 * One titled block of the form. Card-shaped rather than a bare `<fieldset>`
 * so a long HR profile reads as a sequence of discrete steps — the form runs
 * to seven sections, and undifferentiated inputs down a single column is
 * exactly the "half-styled" shape this screen is meant not to be.
 */
function FormSection({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-2xs">
      <SectionHeader icon={icon} title={title} subtitle={subtitle} />
      <div className="grid gap-3.5 p-4">{children}</div>
    </section>
  )
}

/** Explains a field that's visible but not editable by this viewer. */
function ReadOnlyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 rounded-lg bg-muted/50 px-2.5 py-2 text-xs text-muted-foreground">
      <LockIcon className="mt-px size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

/**
 * The id currently sitting in one single-valued slot, as the string the form
 * fields use. Only for the four slots that hold one person — project managers
 * are a list and read separately.
 */
function managerIdOf(employee: Employee | undefined, level: ReviewChainLevel | "departmentHead"): string {
  const assigned = employee?.managerHierarchy?.[level]
  return assigned ? String(assigned.id) : ""
}

/**
 * One rung of the reporting chain. The numbered node and the connector rail
 * are what make Primary → Secondary → Final read as an ORDER rather than as
 * three unrelated dropdowns that happen to sit near each other.
 */
function ChainRow({
  index,
  isLast,
  label,
  required,
  hint,
  children,
}: {
  index: number
  isLast: boolean
  label: string
  required: boolean
  hint: string
  children: React.ReactNode
}) {
  return (
    <li className="relative grid gap-1.5 pl-9">
      <span
        aria-hidden
        className="absolute top-0 left-0 flex size-6 items-center justify-center rounded-full border bg-card text-[11px] font-semibold text-muted-foreground"
      >
        {index + 1}
      </span>
      {/* Reaches down through the list's own gap to meet the next node. */}
      {!isLast && <span aria-hidden className="absolute top-6 bottom-[-1.125rem] left-3 w-px bg-border" />}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className={cn("text-[11px]", required ? "text-muted-foreground" : "text-muted-foreground/70")}>
          {required ? "Required" : "Optional"}
        </span>
      </div>
      {children}
      <FieldHint>{hint}</FieldHint>
    </li>
  )
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <InfoIcon className="mt-px size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

export function EmployeeForm({
  employee,
  onSubmit,
  isPending,
}: {
  employee?: Employee
  onSubmit: (values: EmployeePayload) => void
  isPending: boolean
}) {
  const { data: departments } = useDepartments()

  // Two independent gates, both permission keys rather than role checks — an
  // HR admin who is later given only one of them sees exactly that one. They
  // also gate the FETCHES below: the endpoints behind them are closed to a
  // viewer who lacks the key, so asking anyway is just a 403 in the console.
  const canManageRoles = usePermission(PERMISSIONS.employeesManageRoles)
  const canManageManagers = usePermission(PERMISSIONS.employeesManageReportingManagers)

  const { data: roles, isLoading: rolesLoading } = useRoles(canManageRoles)
  const [managerSearch, setManagerSearch] = useState("")
  const { data: managerResults, isLoading: managersLoading } = useAssignableManagers(
    managerSearch,
    canManageManagers
  )

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      firstName: employee?.firstName ?? "",
      lastName: employee?.lastName ?? "",
      employeeCode: employee?.employeeCode ?? "",
      // The API returns these as numeric ids — the form schema expects
      // strings (to match what <Select> emits), and zod doesn't coerce, so
      // leaving a raw number here failed validation silently on every
      // existing employee (no FormMessage was wired to surface it), which
      // is why Save looked like it did nothing.
      departmentId: employee?.department?.id != null ? String(employee.department.id) : "",
      designationId: employee?.designation?.id != null ? String(employee.designation.id) : "",
      currentLevel: employee?.currentLevel ?? "",
      employmentType: employee?.employmentType ?? "",
      workLocation: employee?.workLocation ?? "",
      primaryManagerId: managerIdOf(employee, "primary"),
      secondaryManagerId: managerIdOf(employee, "secondary"),
      finalManagerId: managerIdOf(employee, "final"),
      departmentHeadId: managerIdOf(employee, "departmentHead"),
      projectManagerIds: employee?.managerHierarchy?.projectManagers?.map((m) => String(m.id)) ?? [],
      workEmail: employee?.user?.email ?? "",
      roleIds: employee?.roles.map((r) => String(r.id)) ?? [],
      dateOfJoining: employee?.dateOfJoining ?? "",
      dateOfBirth: employee?.dateOfBirth ?? "",
      gender: employee?.gender ?? "",
      phone: employee?.phone ?? "",
      personalEmail: employee?.personalEmail ?? "",
      addressLine1: employee?.addressLine1 ?? "",
      addressLine2: employee?.addressLine2 ?? "",
      city: employee?.city ?? "",
      state: employee?.state ?? "",
      postalCode: employee?.postalCode ?? "",
      country: employee?.country ?? "",
      emergencyContactName: employee?.emergencyContactName ?? "",
      emergencyContactPhone: employee?.emergencyContactPhone ?? "",
    },
  })

  const departmentId = form.watch("departmentId")
  const { data: designations } = useDesignations(departmentId || undefined)
  const selectedRoleIds = form.watch("roleIds")

  /**
   * Search is served by the API, so the result set narrows as you type — the
   * people ALREADY chosen have to be merged back in, or their chips would
   * vanish the moment the query stopped matching them.
   */
  const managerOptions: MultiSelectOption[] = useMemo(() => {
    // Everyone already assigned, flattened across all five slots, so their
    // chips survive a search that no longer matches them.
    const chosen = Object.values(employee?.managerHierarchy ?? {})
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .filter(Boolean) as EmployeeSummary[]
    const fromSearch = (managerResults?.data ?? [])
      .filter((candidate) => String(candidate.id) !== String(employee?.id))
      .map<EmployeeSummary>((candidate) => ({
        id: candidate.id,
        fullName: `${candidate.firstName} ${candidate.lastName}`.trim(),
        employeeCode: candidate.employeeCode,
        status: candidate.status,
        currentLevel: candidate.currentLevel,
        designationTitle: candidate.designation?.title ?? null,
        departmentName: candidate.department?.name ?? null,
        profilePhotoUrl: candidate.profilePhotoUrl,
      }))

    const byId = new Map<string, EmployeeSummary>()
    for (const person of [...chosen, ...fromSearch]) byId.set(String(person.id), person)

    return [...byId.values()].map((person) => ({
      value: String(person.id),
      label: person.fullName,
      description: [person.employeeCode, person.designationTitle, person.departmentName]
        .filter(Boolean)
        .join(" · "),
      adornment: (
        <Avatar size="sm" className="size-6">
          {person.profilePhotoUrl && (
            <AvatarImage src={photoUrl(person.profilePhotoUrl)} alt={person.fullName} />
          )}
          <AvatarFallback className="bg-role-hr/12 text-[10px] text-role-hr">
            {initialsOf(person.fullName)}
          </AvatarFallback>
        </Avatar>
      ),
    }))
  }, [managerResults, employee])

  const roleOptions: MultiSelectOption[] = useMemo(
    () =>
      (roles ?? []).map((role) => ({
        value: String(role.id),
        label: role.name,
        description: role.description ?? undefined,
        // Granted by the backend no matter what, so it is shown ticked and
        // un-untickable instead of silently reappearing after save.
        locked: role.slug === DEFAULT_EMPLOYEE_ROLE_SLUG,
        lockedHint: role.slug === DEFAULT_EMPLOYEE_ROLE_SLUG ? "Always granted" : undefined,
        adornment: (
          <span className={`size-2 shrink-0 rounded-full ${roleBadgeClasses(role.slug)}`} aria-hidden />
        ),
      })),
    [roles]
  )

  /**
   * Drops every field this viewer may not set before the request is built. An
   * omitted key means "leave it alone" to the API; a present one they aren't
   * allowed to send would be a 403 for the whole save.
   */
  function handleSubmit(values: EmployeeFormValues) {
    const {
      currentLevel,
      primaryManagerId,
      secondaryManagerId,
      finalManagerId,
      departmentHeadId,
      projectManagerIds,
      roleIds,
      workEmail,
      ...rest
    } = values
    const payload: EmployeePayload = { ...rest, currentLevel: currentLevel || null }

    if (canManageManagers) {
      // "" means "nobody in this slot", which the API expects as an explicit
      // null — omitting the key would instead mean "leave this slot alone".
      payload.primaryManagerId = primaryManagerId || null
      payload.secondaryManagerId = secondaryManagerId || null
      payload.finalManagerId = finalManagerId || null
      payload.departmentHeadId = departmentHeadId || null
      payload.projectManagerIds = projectManagerIds
    }
    if (canManageRoles) {
      payload.roleIds = roleIds
      payload.workEmail = workEmail
    }

    onSubmit(payload)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="grid gap-4" noValidate id="employee-form">
        <fieldset disabled={isPending} className="grid gap-4">
          <FormSection
            icon={UserIcon}
            title="Personal information"
            subtitle="Who this person is on the records"
          >
            <div className="grid gap-3.5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Priya" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Menon" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-3.5 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="employeeCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. ACM-007" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of birth</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-1.5">
                <Label htmlFor="employee-gender">Gender</Label>
                <Select
                  items={GENDER_OPTIONS}
                  // `null` (not `undefined`) for "nothing selected" — Base UI's
                  // Select treats a value of `undefined` as "uncontrolled" on
                  // the first render, so switching to a string once a value is
                  // picked trips its controlled/uncontrolled warning. `null`
                  // matches the component's own `defaultValue = null` convention
                  // for "empty," keeping it controlled from the very first render.
                  value={form.watch("gender") || null}
                  onValueChange={(v) => form.setValue("gender", v ?? "")}
                >
                  <SelectTrigger id="employee-gender" className="h-9 w-full">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FormSection>

          <FormSection
            icon={BriefcaseIcon}
            title="Job details"
            subtitle="Where they sit in the organisation"
          >
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="employee-department">Department</Label>
                <Select
                  items={departments?.map((d) => ({ value: String(d.id), label: d.name }))}
                  value={form.watch("departmentId") || null}
                  onValueChange={(v) => {
                    form.setValue("departmentId", v ?? undefined)
                    form.setValue("designationId", "")
                  }}
                >
                  <SelectTrigger id="employee-department" className="h-9 w-full">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments?.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                {/* Designation IS the job title — there is deliberately no
                    separate "job title" field to keep out of step with it. */}
                <Label htmlFor="employee-designation">Job title (designation)</Label>
                <Select
                  items={designations?.map((d) => ({ value: String(d.id), label: d.title }))}
                  value={form.watch("designationId") || null}
                  onValueChange={(v) => form.setValue("designationId", v ?? undefined)}
                >
                  <SelectTrigger id="employee-designation" className="h-9 w-full">
                    <SelectValue
                      placeholder={departmentId ? "Select job title" : "Select a department first"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {designations?.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="employee-level">Current role / level</Label>
                <Select
                  items={EMPLOYEE_LEVELS}
                  value={form.watch("currentLevel") || null}
                  onValueChange={(v) =>
                    form.setValue("currentLevel", (v as EmployeeFormValues["currentLevel"]) ?? "")
                  }
                >
                  <SelectTrigger id="employee-level" className="h-9 w-full">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYEE_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldHint>Seniority on the career ladder — separate from system roles.</FieldHint>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="employee-employment-type">Employment type</Label>
                <Select
                  items={EMPLOYMENT_TYPES}
                  value={form.watch("employmentType") || null}
                  onValueChange={(v) => form.setValue("employmentType", v ?? "")}
                >
                  <SelectTrigger id="employee-employment-type" className="h-9 w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FormField
                control={form.control}
                name="workLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work location</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Jaipur" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateOfJoining"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of joining</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </FormSection>

          <FormSection
            icon={NetworkIcon}
            title="Reporting manager"
            subtitle="Who this employee reports to, and in what order"
          >
            {canManageManagers ? (
              <>
                <ol className="grid gap-4.5">
                  {MANAGER_LEVELS.map((level, index) => {
                    const fieldName = `${level.value}ManagerId` as const
                    const error = form.formState.errors[fieldName]

                    return (
                      <ChainRow
                        key={level.value}
                        index={index}
                        isLast={index === MANAGER_LEVELS.length - 1}
                        label={level.label}
                        required={level.required}
                        hint={level.hint}
                      >
                        <SearchSelect
                          id={`employee-${level.value}-manager`}
                          aria-label={level.label}
                          options={managerOptions}
                          value={form.watch(fieldName) || null}
                          onChange={(next) => form.setValue(fieldName, next ?? "", { shouldValidate: true })}
                          onSearchChange={setManagerSearch}
                          isLoading={managersLoading}
                          invalid={Boolean(error)}
                          clearable={!level.required}
                          placeholder={`Select a ${level.label.toLowerCase()}`}
                          searchPlaceholder="Search active employees…"
                          emptyMessage="No active employees match that search."
                        />
                        {error?.message && (
                          <p className="text-xs text-destructive">{String(error.message)}</p>
                        )}
                      </ChainRow>
                    )
                  })}
                </ol>
                <div className="grid gap-4.5 border-t pt-4">
                  {/* Rendered OUTSIDE the numbered chain on purpose: §4 lists
                      these alongside the review line, not inside it, and the UI
                      must not imply a Department Head is the Final Reviewer. */}
                  <p className="text-xs font-semibold text-muted-foreground">
                    Additional relationships — outside the review chain
                  </p>

                  {ADDITIONAL_MANAGER_RELATIONSHIPS.map((relationship) => (
                    <div key={relationship.value} className="grid gap-1.5">
                      <Label htmlFor={`employee-${relationship.value}`}>{relationship.label}</Label>
                      {relationship.multiple ? (
                        <MultiSelect
                          id={`employee-${relationship.value}`}
                          aria-label={relationship.label}
                          options={managerOptions}
                          value={form.watch("projectManagerIds")}
                          onChange={(next) => form.setValue("projectManagerIds", next)}
                          onSearchChange={setManagerSearch}
                          isLoading={managersLoading}
                          placeholder="Select one or more project managers"
                          searchPlaceholder="Search active employees…"
                          emptyMessage="No active employees match that search."
                        />
                      ) : (
                        <SearchSelect
                          id={`employee-${relationship.value}`}
                          aria-label={relationship.label}
                          options={managerOptions}
                          value={form.watch("departmentHeadId") || null}
                          onChange={(next) => form.setValue("departmentHeadId", next ?? "")}
                          onSearchChange={setManagerSearch}
                          isLoading={managersLoading}
                          clearable
                          placeholder="Select a department head"
                          searchPlaceholder="Search active employees…"
                          emptyMessage="No active employees match that search."
                        />
                      )}
                      <FieldHint>{relationship.hint}</FieldHint>
                    </div>
                  ))}
                </div>

                <FieldHint>
                  Any active employee can be selected. These are reporting assignments, not system
                  roles — being someone&apos;s manager grants no extra access.
                </FieldHint>
              </>
            ) : (
              <>
                <ol className="grid gap-4.5">
                  {MANAGER_LEVELS.map((level, index) => {
                    const assigned = employee?.managerHierarchy?.[level.value] ?? null

                    return (
                      <ChainRow
                        key={level.value}
                        index={index}
                        isLast={index === MANAGER_LEVELS.length - 1}
                        label={level.label}
                        required={level.required}
                        hint={level.hint}
                      >
                        {assigned ? (
                          <div className="flex items-center gap-2.5 rounded-lg border p-2.5">
                            <Avatar size="sm">
                              {assigned.profilePhotoUrl && (
                                <AvatarImage src={photoUrl(assigned.profilePhotoUrl)} alt={assigned.fullName} />
                              )}
                              <AvatarFallback className="bg-role-hr/12 text-[10px] text-role-hr">
                                {initialsOf(assigned.fullName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{assigned.fullName}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {assigned.designationTitle ?? assigned.employeeCode}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="rounded-lg border border-dashed p-2.5 text-center text-xs text-muted-foreground">
                            Not assigned
                          </p>
                        )}
                      </ChainRow>
                    )
                  })}
                </ol>
                <div className="grid gap-3 border-t pt-4">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Additional relationships — outside the review chain
                  </p>
                  {ADDITIONAL_MANAGER_RELATIONSHIPS.map((relationship) => {
                    const people = relationship.multiple
                      ? (employee?.managerHierarchy?.projectManagers ?? [])
                      : [ employee?.managerHierarchy?.departmentHead ].filter(Boolean)

                    return (
                      <div key={relationship.value} className="grid gap-1.5">
                        <span className="text-sm font-medium">{relationship.label}</span>
                        {people.length === 0 ? (
                          <p className="rounded-lg border border-dashed p-2.5 text-center text-xs text-muted-foreground">
                            Not assigned
                          </p>
                        ) : (
                          people.map((person) => (
                            <div key={person!.id} className="flex items-center gap-2.5 rounded-lg border p-2.5">
                              <Avatar size="sm">
                                {person!.profilePhotoUrl && (
                                  <AvatarImage src={photoUrl(person!.profilePhotoUrl)} alt={person!.fullName} />
                                )}
                                <AvatarFallback className="bg-role-hr/12 text-[10px] text-role-hr">
                                  {initialsOf(person!.fullName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{person!.fullName}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {person!.designationTitle ?? person!.employeeCode}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )
                  })}
                </div>
                <ReadOnlyNote>Reporting managers are assigned by Admin or HR.</ReadOnlyNote>
              </>
            )}
          </FormSection>

          <FormSection
            icon={KeyRoundIcon}
            title="System access & roles"
            subtitle="The login account behind this profile"
          >
            {canManageRoles ? (
              <>
                <FormField
                  control={form.control}
                  name="workEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Work email</FormLabel>
                      <FormControl>
                        {/* Read-only once an account exists: moving a login to
                            a new address is an identity change, and the API
                            refuses it from this endpoint. */}
                        <Input
                          type="email"
                          {...field}
                          readOnly={Boolean(employee?.user)}
                          className={employee?.user ? "bg-muted/50 text-muted-foreground" : undefined}
                          placeholder="priya@company.com"
                        />
                      </FormControl>
                      <FormMessage />
                      <FieldHint>
                        {employee?.user
                          ? "The address this employee signs in with. It can't be changed from here."
                          : "Leave blank if this employee needs no login. Otherwise they get an email to set their own password — no password is ever set here."}
                      </FieldHint>
                    </FormItem>
                  )}
                />

                <div className="grid gap-1.5">
                  <Label htmlFor="employee-roles">Roles</Label>
                  <MultiSelect
                    id="employee-roles"
                    aria-label="Roles"
                    options={roleOptions}
                    value={selectedRoleIds}
                    onChange={(next) => form.setValue("roleIds", next)}
                    isLoading={rolesLoading}
                    searchable={false}
                    placeholder="Employee (default)"
                    emptyMessage="No roles defined yet."
                  />
                  <FieldHint>
                    Every account gets the Employee role. Add HR or Admin on top to let this person
                    manage other employees.
                  </FieldHint>
                </div>

                {employee?.user?.status === "invited" && (
                  <p className="rounded-lg bg-warning/10 px-2.5 py-2 text-xs text-warning">
                    This account has been invited but hasn&apos;t set a password yet.
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="grid gap-1.5">
                  <p className="text-xs text-muted-foreground">Work email</p>
                  <p className="text-sm font-medium">{employee?.user?.email ?? "No login account"}</p>
                </div>
                {employee && employee.roles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {employee.roles.map((role) => (
                      <Badge key={role.id} className={roleBadgeClasses(role.slug)}>
                        {role.name}
                      </Badge>
                    ))}
                  </div>
                )}
                <ReadOnlyNote>Roles and system access are managed by Admin or HR.</ReadOnlyNote>
              </>
            )}
          </FormSection>

          <FormSection icon={PhoneIcon} title="Contact" subtitle="How to reach them personally">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input type="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="personalEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Personal email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </FormSection>

          <FormSection icon={MapPinIcon} title="Address" subtitle="Current residential address">
            <FormField
              control={form.control}
              name="addressLine1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Street address</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter full address" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="addressLine2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address line 2</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Apartment, suite, unit, etc. (optional)" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-3.5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal code</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </FormSection>

          <FormSection
            icon={ShieldAlertIcon}
            title="Emergency contact"
            subtitle="Who to reach in an emergency"
          >
            <div className="grid gap-3.5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="emergencyContactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="emergencyContactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact phone</FormLabel>
                    <FormControl>
                      <Input type="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </FormSection>
        </fieldset>
      </form>
    </Form>
  )
}

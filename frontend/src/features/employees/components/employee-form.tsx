"use client"

import { useEffect, useMemo, useRef, useState, type Ref } from "react"
import { useQuery } from "@tanstack/react-query"
import { useForm, type FieldErrors } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { LockIcon, MailIcon, PlusIcon, RefreshCwIcon, XIcon } from "lucide-react"
import { cn } from "cn"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import { PanelSection } from "@/components/ui/panel"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { InfoTip } from "@/components/ui/tooltip"
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
import {
  buildEmployeeFormSchema,
  maxBirthDateIso,
  maxJoiningIso,
  minJoiningIso,
  MAX_JOINING_YEARS_BACK,
  todayIso,
  MAX_JOINING_DAYS_AHEAD,
  WORK_LOCATIONS,
  emergencyContactsPayload,
  identityNumbersPayload,
  phonesPayload,
  savedPersonalDetails,
  type EmployeeFormValues,
  type EmployeePayload,
} from "@/features/employees/schemas"
import { companySettingsApi, employeesApi } from "@/features/employees/api"
import { generatePassword } from "@/features/employees/generate-password"
import {
  useDepartments,
  useDesignations,
  useEmploymentTypes,
  useAssignableManagers,
  useRoles,
} from "@/features/employees/hooks/use-employees"
import {
  GENDER_OPTIONS,
  DEFAULT_EMPLOYEE_ROLE_SLUG,
  MANAGER_LEVELS,
  ADDITIONAL_MANAGER_RELATIONSHIPS,
  OTHER_CITY,
} from "@/features/employees/constants"
import { AddressLocationFields, DEFAULT_COUNTRY } from "@/features/employees/components/address-location-fields"
import { digitsOnly } from "@/features/employees/input-format"
import {
  BankDetailsFields,
  EmergencyContactsField,
  IdentityNumbersFields,
  PhoneListField,
} from "@/features/employees/components/personal-detail-fields"
import { formatAadhaar, hasSensitiveDetails } from "@/features/employees/components/sensitive-field"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { useDebounced } from "@/hooks/use-debounced"
import { PERMISSIONS, roleBadgeClasses } from "@/constants/permissions"
import { API_ORIGIN } from "@/lib/api-client"
import type { Employee, EmployeeSummary, ReviewChainLevel } from "@/types/employees"

/** Base UI's Select wants {value,label} items; WORK_LOCATIONS is a plain list. */
const WORK_LOCATION_OPTIONS = WORK_LOCATIONS.map((value) => ({ value, label: value }))

/** "1st", "2nd", "3rd", "4th"… for the reporting-level labels. */
function ordinal(n: number) {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"
  return `${n}${suffix}`
}

/** The ✕ beside every optional reporting level. */
function RemoveLevelButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="mt-0.5 shrink-0 text-muted-foreground hover:text-destructive"
      aria-label={`Remove ${label}`}
      onClick={onClick}
    >
      <XIcon className="size-4" />
    </Button>
  )
}

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

/**
 * One titled block of the form. Card-shaped rather than a bare `<fieldset>`
 * so a long HR profile reads as a sequence of discrete steps — the form runs
 * to seven sections, and undifferentiated inputs down a single column is
 * exactly the "half-styled" shape this screen is meant not to be.
 */
function FormSection({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: React.ReactNode
  children: React.ReactNode
}) {
  // The shared panel card (uppercase label strip) — the same one the filters use.
  return (
    <PanelSection title={title} description={subtitle}>
      {children}
    </PanelSection>
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
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <InfoTip label={label}>{hint}</InfoTip>
        </div>
        <span className={cn("text-[11px]", required ? "text-muted-foreground" : "text-muted-foreground/70")}>
          {required ? "Required" : "Optional"}
        </span>
      </div>
      {children}
    </li>
  )
}

function ManagerSlotField({
  id,
  label,
  options,
  value,
  onChange,
  onSearchChange,
  isLoading,
  error,
}: {
  id: string
  label: string
  options: MultiSelectOption[]
  value: string
  onChange: (val: string) => void
  onSearchChange: (search: string) => void
  isLoading: boolean
  error?: string
}) {
  // A plain dropdown: pick someone, change them by picking again, clear with
  // the × — no separate Assign / Change / Remove step.
  return (
    <SearchSelect
      id={id}
      aria-label={label}
      options={options}
      value={value || null}
      onChange={(next) => onChange(next ?? "")}
      onSearchChange={onSearchChange}
      isLoading={isLoading}
      invalid={Boolean(error)}
      clearable
      placeholder={`Select a ${label.toLowerCase()}`}
      searchPlaceholder="Search active employees…"
      emptyMessage="No active employees match that search."
    />
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
  const { data: employmentTypes } = useEmploymentTypes()

  // The next employee ID, from the pattern set in Settings → Other → Initial
  // ID. Only for a NEW employee: an existing one already has a code, and
  // suggesting a different one would invite renumbering somebody by accident.
  //
  // A suggestion, never a reservation — the field stays editable, nothing is
  // consumed by asking, and the database's uniqueness constraint is still what
  // decides. So a stale value here costs a validation error, not a duplicate.
  const { data: suggestedCode } = useQuery({
    queryKey: ["employees", "next-code"],
    queryFn: employeesApi.nextCode,
    enabled: !employee,
    staleTime: 0,
  })

  // The company's work-email domain, so the form can refuse a wrong address
  // with the same sentence the server would. Read-only here — it is set in
  // Settings, and the server decides regardless of what this says.
  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: companySettingsApi.get,
  })
  const workEmailDomain = companySettings?.workEmailDomain ?? null

  // Two independent gates, both permission keys rather than role checks — an
  // HR admin who is later given only one of them sees exactly that one. They
  // also gate the FETCHES below: the endpoints behind them are closed to a
  // viewer who lacks the key, so asking anyway is just a 403 in the console.
  const canManageRoles = usePermission(PERMISSIONS.employeesManageRoles)
  const canManageManagers = usePermission(PERMISSIONS.employeesManageReportingManagers)
  // Bank details and identity numbers are on the form only when the API sent
  // them for this record (always, for a new one). For anybody else they are
  // neither shown nor sent — sending the blanks would clear numbers this
  // viewer never saw.
  const showSensitive = !employee || hasSensitiveDetails(employee)

  const { data: roles, isLoading: rolesLoading } = useRoles(canManageRoles)
  const [managerSearch, setManagerSearch] = useState("")
  const { data: managerResults, isLoading: managersLoading } = useAssignableManagers(
    managerSearch,
    canManageManagers
  )

  // Read through a ref by the schema, because the domain arrives after the
  // form (and its resolver) already exists — see buildEmployeeFormSchema.
  const workEmailDomainRef = useRef(workEmailDomain)
  useEffect(() => {
    workEmailDomainRef.current = workEmailDomain
  }, [workEmailDomain])

  const form = useForm<EmployeeFormValues>({
    // Live: a field is checked as it is typed in and again when it is left,
    // so a mistake shows under the field on the spot instead of only after
    // Save. Save still runs the full check (handleSubmit/reportInvalid) for
    // anything never touched.
    mode: "all",
    // Built per mode: the joining-date and age windows are hiring rules and
    // must not fire on somebody who is already here — see the schema.
    resolver: zodResolver(
      buildEmployeeFormSchema({
        isNew: !employee,
        workEmailDomain: () => workEmailDomainRef.current,
        saved: savedPersonalDetails(employee),
      })
    ),
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
      employmentTypeId: employee?.employmentTypeId != null ? String(employee.employmentTypeId) : "",
      // Faridabad is the head office, so it is the answer for most new hires.
      workLocation: (employee?.workLocation as EmployeeFormValues["workLocation"]) ?? "Faridabad",
      primaryManagerId: managerIdOf(employee, "primary"),
      secondaryManagerId: managerIdOf(employee, "secondary"),
      finalManagerId: managerIdOf(employee, "final"),
      projectManagerIds: employee?.managerHierarchy?.projectManagers?.map((m) => String(m.id)) ?? [],
      // Already in reporting order from the API (tier ascending), and the
      // order is the meaning, so it is kept exactly as it arrives.
      additionalManagerIds:
        employee?.managerHierarchy?.additionalManagers?.map((m) => String(m.id)) ?? [],
      workEmail: employee?.user?.email ?? "",
      roleIds: employee?.roles.map((r) => String(r.id)) ?? [],
      // Generated up front for a new joiner, so the field is correct before
      // anybody touches it. Empty on an edit, where a value would mean
      // resetting a password nobody asked to reset.
      password: employee ? "" : generatePassword(),
      // Today, because the overwhelmingly common case is somebody starting now.
      dateOfJoining: employee?.dateOfJoining ?? todayIso(),
      dateOfBirth: employee?.dateOfBirth ?? "",
      celebrationDate: employee?.celebrationDate ?? "",
      gender: (employee?.gender as EmployeeFormValues["gender"]) ?? "male",
      // One empty box to type into when there is nothing on file yet.
      phones: employee?.phones.length ? employee.phones : [""],
      personalEmail: employee?.personalEmail ?? "",
      addressLine1: employee?.addressLine1 ?? "",
      addressLine2: employee?.addressLine2 ?? "",
      city: employee?.city ?? "",
      cityOther: "",
      state: employee?.state ?? "",
      postalCode: employee?.postalCode ?? "",
      country: employee?.country || DEFAULT_COUNTRY,
      emergencyContacts: employee?.emergencyContacts.length
        ? savedPersonalDetails(employee).emergencyContacts
        : [{ name: "", relation: "", phone: "" }],
      bankAccountNumber: employee?.bankAccountNumber ?? "",
      bankAccountHolderName: employee?.bankAccountHolderName ?? "",
      bankIfscCode: employee?.bankIfscCode ?? "",
      aadhaarNumber: formatAadhaar(employee?.aadhaarNumber ?? ""),
      panNumber: employee?.panNumber ?? "",
      otherIdentityNumbers: (employee?.otherIdentityNumbers ?? []).map((r) => ({ label: r.label ?? "", number: r.number ?? "" })),
    },
  })

  // Prefill the ID once the suggestion arrives.
  //
  // In an effect rather than in defaultValues because the value is fetched:
  // the form is built before the request resolves, and react-hook-form only
  // reads defaultValues once. Guarded on the field being untouched and empty
  // so a slow response can never overwrite something already typed.
  const suggestion = suggestedCode?.employeeCode
  useEffect(() => {
    if (employee || !suggestion) return
    if (form.getValues("employeeCode")) return
    if (form.formState.dirtyFields.employeeCode) return

    form.setValue("employeeCode", suggestion)
  }, [employee, suggestion, form])

  // Employee ID checked as it is typed — already in use, or below the Initial
  // ID — so the problem shows under the field on the spot rather than as a
  // failed save. Skipped for an unchanged code on an edit.
  const typedCode = (form.watch("employeeCode") ?? "").trim()
  const settledCode = useDebounced(typedCode, 400)
  const checkCode = settledCode !== "" && settledCode !== (employee?.employeeCode ?? "")
  const { data: codeCheck } = useQuery({
    queryKey: ["employees", "code-available", settledCode, employee?.id ?? null],
    queryFn: () => employeesApi.codeAvailable(settledCode, employee?.id),
    enabled: checkCode,
    staleTime: 0,
  })
  // Only trusted once it answers for what is in the box right now.
  const codeProblem =
    checkCode && settledCode === typedCode && codeCheck?.available === false
      ? (codeCheck.message ?? "This employee ID can't be used")
      : null

  useEffect(() => {
    const current = form.getFieldState("employeeCode").error
    if (codeProblem) {
      form.setError("employeeCode", { type: "taken", message: codeProblem })
    } else if (current?.type === "taken") {
      form.clearErrors("employeeCode")
    }
  }, [codeProblem, form])

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
   * How much of the fixed review chain is on screen.
   *
   * Only the 1st level is mandatory, so only it is shown to begin with; "Add
   * manager" reveals the 2nd and then the 3rd, and after that starts appending
   * `additional` rows. An employee being edited shows however many slots they
   * already have filled, so nothing they have is hidden.
   */
  const [visibleChainSlots, setVisibleChainSlots] = useState(() => {
    const filled = MANAGER_LEVELS.reduce(
      (count, level, index) => (managerIdOf(employee, level.value) ? index + 1 : count),
      1
    )
    return Math.min(Math.max(filled, 1), MANAGER_LEVELS.length)
  })
  const additionalManagerIds = form.watch("additionalManagerIds")

  function addManagerLevel() {
    if (visibleChainSlots < MANAGER_LEVELS.length) {
      setVisibleChainSlots(visibleChainSlots + 1)
      return
    }
    form.setValue("additionalManagerIds", [...additionalManagerIds, ""])
  }

  function setAdditionalManager(index: number, value: string) {
    const next = [...additionalManagerIds]
    next[index] = value
    form.setValue("additionalManagerIds", next)
  }

  // Removing the 4th level promotes the 5th rather than leaving a gap — the
  // position in this array IS the reporting tier, both here and on the server.
  function removeAdditionalManager(index: number) {
    form.setValue(
      "additionalManagerIds",
      additionalManagerIds.filter((_, i) => i !== index)
    )
  }

  /**
   * Removing the 2nd or 3rd level, which are fixed slots rather than a list.
   *
   * Everything below shifts up, so the chain stays contiguous: drop the 2nd
   * and whoever was 3rd becomes 2nd. Leaving a filled 3rd above an empty 2nd
   * would read as a reporting line with a hole in it, and the appraisal
   * workflow walks these three in order.
   */
  function removeChainSlot(index: number) {
    const ids = MANAGER_LEVELS.map((level) => form.watch(`${level.value}ManagerId` as const) || "")
    ids.splice(index, 1)
    ids.push("")
    MANAGER_LEVELS.forEach((level, i) => {
      form.setValue(`${level.value}ManagerId` as const, ids[i], { shouldValidate: true })
    })
    setVisibleChainSlots(Math.max(visibleChainSlots - 1, 1))
  }

  /**
   * The people already holding a slot, so the other slots stop offering them.
   *
   * Nobody may hold two slots for the same employee — EmployeeManager refuses
   * it, and a reporting line naming the same person as both 1st and 3rd level
   * would have their appraisal reviewed twice by one reviewer. Taking them out
   * of the remaining dropdowns is how that reads as "already assigned" rather
   * than as a save that fails after the fact.
   */
  const takenManagerIds = [
    form.watch("primaryManagerId"),
    form.watch("secondaryManagerId"),
    form.watch("finalManagerId"),
    ...form.watch("projectManagerIds"),
    ...additionalManagerIds,
  ].filter(Boolean)

  /** `managerOptions` minus everyone else's slot, keeping this slot's own. */
  function optionsFor(currentValue: string | string[]) {
    const keep = new Set(Array.isArray(currentValue) ? currentValue : [currentValue])
    return managerOptions.filter((o) => keep.has(o.value) || !takenManagerIds.includes(o.value))
  }

  /**
   * Says why a save didn't happen.
   *
   * Without this, a failed validation on a field that is scrolled out of view
   * — or on one whose FormMessage was never wired up — makes the Save button
   * look broken: react-hook-form simply declines to call the submit handler
   * and nothing appears anywhere. The offending field is named, focused and
   * scrolled to, so "nothing happened" can't be the whole story.
   */
  function reportInvalid(errors: FieldErrors<EmployeeFormValues>) {
    const entries = Object.entries(errors)
    // A list field (phones, emergency contacts) nests its errors per row —
    // `phones.1`, `emergencyContacts.0.phone` — so the first message, and the
    // input to scroll to, is found by walking down to it.
    const [ name, message ] = entries.length ? firstFieldError(entries[0][0], entries[0][1]) : []
    const others = entries.length - 1

    // Says how many more there are, so fixing the first isn't followed by a
    // second failed save with no warning.
    toast.error(message ?? "Some details still need fixing before this can be saved.", {
      description: others > 0 ? `${others} more ${others === 1 ? "field needs" : "fields need"} fixing.` : undefined,
    })
    if (name) {
      form.setFocus(name as keyof EmployeeFormValues)
      // Dropdowns (managers, roles, country/state/city) carry no `name`, only
      // an id — `primaryManagerId` → `employee-primary-manager`.
      const id =
        name === "roleIds"
          ? "employee-roles"
          : `employee-${name.replace(/Id$/, "").replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`
      const target = document.querySelector(`[name="${name}"]`) ?? document.getElementById(id)
      target?.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }

  /**
   * Drops every field this viewer may not set before the request is built. An
   * omitted key means "leave it alone" to the API; a present one they aren't
   * allowed to send would be a 403 for the whole save.
   */
  function handleSubmit(values: EmployeeFormValues) {
    // Checked here rather than in the zod schema because the domain is fetched
    // — the schema is built before it arrives, and a rule that isn't known yet
    // can't be compiled into it. Worded identically to
    // Employees::AccountProvisioner#reject_foreign_domain.
    if (codeProblem) {
      form.setError("employeeCode", { type: "taken", message: codeProblem })
      reportInvalid({ employeeCode: { type: "taken", message: codeProblem } })
      return
    }

    if (workEmailDomain && values.workEmail && !values.workEmail.toLowerCase().endsWith(`@${workEmailDomain.toLowerCase()}`)) {
      const message = `Work email must end with @${workEmailDomain}`
      form.setError("workEmail", { message })
      reportInvalid({ workEmail: { type: "manual", message } })
      return
    }

    // Mandatory on a NEW employee only. Applying it to an edit too would make
    // every legacy record without one unsaveable — you could not correct a
    // surname until you had also found somebody a manager — and the rule is
    // about who is being hired, not about who is already here.
    if (!employee && canManageManagers && !values.primaryManagerId) {
      const message = "A 1st level manager is required"
      form.setError("primaryManagerId", { message })
      // These checks run after zod passes, so reportInvalid never saw them —
      // call it here too, or the save fails with no toast at all.
      reportInvalid({ primaryManagerId: { type: "manual", message } })
      return
    }

    const {
      currentLevel,
      employmentTypeId,
      primaryManagerId,
      secondaryManagerId,
      finalManagerId,
      projectManagerIds,
      additionalManagerIds,
      cityOther,
      roleIds,
      workEmail,
      password,
      phones,
      emergencyContacts,
      bankAccountNumber,
      bankAccountHolderName,
      bankIfscCode,
      aadhaarNumber,
      panNumber,
      otherIdentityNumbers,
      ...rest
    } = values
    const payload: EmployeePayload = {
      ...rest,
      phones: phonesPayload(phones),
      emergencyContacts: emergencyContactsPayload(emergencyContacts),
      currentLevel: currentLevel || null,
      // "" is "not set", which has to reach the API as null to clear it.
      employmentTypeId: employmentTypeId || null,
      // "Other" is a prompt to type one, not a city anybody lives in.
      city: rest.city === OTHER_CITY ? cityOther?.trim() || null : rest.city,
    }

    if (showSensitive) {
      payload.bankAccountNumber = bankAccountNumber
      payload.bankAccountHolderName = bankAccountHolderName
      payload.bankIfscCode = bankIfscCode
      payload.aadhaarNumber = aadhaarNumber.replace(/\s/g, "")
      payload.panNumber = panNumber
      payload.otherIdentityNumbers = identityNumbersPayload(otherIdentityNumbers)
    }
    if (canManageManagers) {
      // "" means "nobody in this slot", which the API expects as an explicit
      // null — omitting the key would instead mean "leave this slot alone".
      payload.primaryManagerId = primaryManagerId || null
      payload.secondaryManagerId = secondaryManagerId || null
      payload.finalManagerId = finalManagerId || null
      payload.projectManagerIds = projectManagerIds
      // Blank rows are slots somebody added and left empty; they are dropped
      // rather than sent, so an empty box never becomes a reporting tier.
      payload.additionalManagerIds = additionalManagerIds.filter(Boolean)
    }
    if (canManageRoles) {
      payload.roleIds = roleIds
      payload.workEmail = workEmail
      // Only sent when actually filled in. An empty string would still be a
      // present key; omitting it leaves the server to generate one, which is
      // what an admin who cleared the field is asking for.
      // No "require a change" control here — that lives beside the Send
      // button on the employee's own page, where an admin is deciding about
      // an account that already exists. Omitting it lets the server apply its
      // default, which is to require one.
      if (password) payload.password = password
    }

    onSubmit(payload)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit, reportInvalid)} className="grid gap-4" noValidate id="employee-form">
        <fieldset disabled={isPending} className="grid gap-4">
          <FormSection
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
            <div className="grid gap-3.5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="employeeCode"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1.5">
                      <FormLabel>Employee ID</FormLabel>
                      {/* Said out loud rather than left as a silently-filled
                          field: somebody who did not set the pattern should know
                          where the value came from before they save it. */}
                      {!employee && suggestedCode?.employeeCode && (
                        <InfoTip label="Employee ID">
                          Suggested from your Initial ID setting. Edit it if you need something else.
                        </InfoTip>
                      )}
                    </div>
                    <FormControl>
                      <Input {...field} placeholder={suggestedCode?.employeeCode ?? "e.g. ACM-007"} />
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
                  // Never cleared back to empty: the server accepts only male
                  // or female, so "nothing selected" is not a state this field
                  // can be saved in.
                  value={form.watch("gender")}
                  onValueChange={(v) => v && form.setValue("gender", v as EmployeeFormValues["gender"])}
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
            <div className="grid gap-3.5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1.5">
                      <FormLabel>Date of birth</FormLabel>
                      {!employee && <InfoTip label="Date of birth">Employees must be at least 22 years old.</InfoTip>}
                    </div>
                    <FormControl>
                      {/* The calendar itself stops at the 22nd birthday, so a
                          date that would be refused can't be picked at all.
                          The zod rule still runs — `max` is advisory in a
                          typed-in date, and the server decides regardless. */}
                      {/* Capped for a NEW hire only. On an existing record the
                          cap would make their own stored date unpickable. */}
                      <DatePicker max={employee ? undefined : maxBirthDateIso()} placeholder="dd/mm/yyyy" clearable {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="celebrationDate"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1.5">
                      <FormLabel>Celebration date</FormLabel>
                      <InfoTip label="Celebration date">
                        Optional — a day they celebrate that isn&apos;t their date of birth.
                      </InfoTip>
                    </div>
                    <FormControl>
                      <DatePicker placeholder="dd/mm/yyyy" clearable {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </FormSection>

          <FormSection
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
                <Label htmlFor="employee-designation">Designation</Label>
                <Select
                  items={designations?.map((d) => ({ value: String(d.id), label: d.title }))}
                  value={form.watch("designationId") || null}
                  onValueChange={(v) => form.setValue("designationId", v ?? undefined)}
                >
                  <SelectTrigger id="employee-designation" className="h-9 w-full">
                    <SelectValue
                      placeholder={departmentId ? "Select designation" : "Select a department first"}
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
                <Label htmlFor="employee-employment-type">Employment type</Label>
                <Select
                  items={employmentTypes?.map((t) => ({ value: String(t.id), label: t.name }))}
                  value={form.watch("employmentTypeId") || null}
                  onValueChange={(v) => form.setValue("employmentTypeId", v ?? "")}
                >
                  <SelectTrigger id="employee-employment-type" className="h-9 w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {employmentTypes?.map((type) => (
                      <SelectItem key={type.id} value={String(type.id)}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="employee-work-location">Work location</Label>
                  <InfoTip label="Work location">Faridabad is the head office and the default.</InfoTip>
                </div>
                <Select
                  items={WORK_LOCATION_OPTIONS}
                  value={form.watch("workLocation")}
                  onValueChange={(v) =>
                    v && form.setValue("workLocation", v as EmployeeFormValues["workLocation"])
                  }
                >
                  <SelectTrigger id="employee-work-location" className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_LOCATIONS.map((location) => (
                      <SelectItem key={location} value={location}>
                        {location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FormField
                control={form.control}
                name="dateOfJoining"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1.5">
                      <FormLabel>Date of joining</FormLabel>
                      {!employee && (
                        <InfoTip label="Date of joining">
                          Any date in the last {MAX_JOINING_YEARS_BACK} years, or up to{" "}
                          {MAX_JOINING_DAYS_AHEAD} days ahead.
                        </InfoTip>
                      )}
                    </div>
                    <FormControl>
                      <DatePicker
                        min={employee ? undefined : minJoiningIso()}
                        max={employee ? undefined : maxJoiningIso()}
                        clearable={!!employee}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </FormSection>

          <FormSection
            title="Reporting manager"
            subtitle={
              // The note covers the whole section rather than one field, so
              // it hangs off the section's own line. Only for someone who can
              // assign managers — to a read-only viewer it explains a choice
              // they aren't offered.
              <span className="inline-flex items-center gap-1.5">
                Who this employee reports to, and in what order
                {canManageManagers && (
                  <InfoTip label="Reporting managers">
                    Any active employee can be selected. These are reporting assignments, not system
                    roles — being someone&apos;s manager grants no extra access.
                  </InfoTip>
                )}
              </span>
            }
          >
            {canManageManagers ? (
              <>
                <ol className="grid gap-4.5">
                  {/* The first three are the review chain and keep their fixed
                      slots — the appraisal workflow reads them by name. Levels
                      beyond them are added on demand below; they are reporting
                      lines, not reviewers, and nothing in an appraisal reads
                      them. */}
                  {MANAGER_LEVELS.map((level, index) => {
                    const fieldName = `${level.value}ManagerId` as const
                    const error = form.formState.errors[fieldName]
                    // Only the 1st level is offered up front. The 2nd and 3rd
                    // appear as they are added, so an employee with one manager
                    // isn't shown two empty boxes they are expected to fill.
                    if (index >= visibleChainSlots) return null

                    return (
                      <ChainRow
                        key={level.value}
                        index={index}
                        isLast={index === visibleChainSlots - 1 && additionalManagerIds.length === 0}
                        label={level.label}
                        required={level.required}
                        hint={level.hint}
                      >
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <ManagerSlotField
                              id={`employee-${level.value}-manager`}
                              label={level.label}
                              options={optionsFor(form.watch(fieldName) || "")}
                              value={form.watch(fieldName) || ""}
                              onChange={(next) => form.setValue(fieldName, next, { shouldValidate: true })}
                              onSearchChange={setManagerSearch}
                              isLoading={managersLoading}
                              error={error?.message ? String(error.message) : undefined}
                            />
                          </div>
                          {/* Every level but the first can be taken away. */}
                          {index > 0 && (
                            <RemoveLevelButton label={level.label} onClick={() => removeChainSlot(index)} />
                          )}
                        </div>
                        {error?.message && (
                          <p className="text-xs text-destructive">{String(error.message)}</p>
                        )}
                      </ChainRow>
                    )
                  })}
                  {additionalManagerIds.map((value, index) => (
                    <ChainRow
                      key={`additional-${index}`}
                      index={MANAGER_LEVELS.length + index}
                      isLast={index === additionalManagerIds.length - 1}
                      label={`${ordinal(MANAGER_LEVELS.length + index + 1)} Level Manager`}
                      required={false}
                      hint="Further up the reporting line — not part of the appraisal review chain"
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <ManagerSlotField
                            id={`employee-additional-manager-${index}`}
                            label={`${ordinal(MANAGER_LEVELS.length + index + 1)} Level Manager`}
                            options={optionsFor(value)}
                            value={value}
                            onChange={(next) => setAdditionalManager(index, next)}
                            onSearchChange={setManagerSearch}
                            isLoading={managersLoading}
                          />
                        </div>
                        <RemoveLevelButton
                          label={`${ordinal(MANAGER_LEVELS.length + index + 1)} Level Manager`}
                          onClick={() => removeAdditionalManager(index)}
                        />
                      </div>
                    </ChainRow>
                  ))}
                </ol>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="justify-self-start"
                  onClick={addManagerLevel}
                >
                  <PlusIcon className="size-4" />
                  Add manager
                </Button>
                <div className="grid gap-4.5 border-t pt-4">
                  {/* Rendered OUTSIDE the numbered chain on purpose: §4 lists
                      these alongside the review line, not inside it, and the UI
                      must not imply a Department Head is the Final Reviewer. */}
                  <p className="text-xs font-semibold text-muted-foreground">
                    Additional relationships — outside the review chain
                  </p>

                  {ADDITIONAL_MANAGER_RELATIONSHIPS.map((relationship) => (
                    <div key={relationship.value} className="grid gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor={`employee-${relationship.value}`}>{relationship.label}</Label>
                        <InfoTip label={relationship.label}>{relationship.hint}</InfoTip>
                      </div>
                      {relationship.multiple ? (
                        <MultiSelect
                          id={`employee-${relationship.value}`}
                          aria-label={relationship.label}
                          options={optionsFor(form.watch("projectManagerIds"))}
                          value={form.watch("projectManagerIds")}
                          onChange={(next) => form.setValue("projectManagerIds", next)}
                          onSearchChange={setManagerSearch}
                          isLoading={managersLoading}
                          placeholder="Select one or more project managers"
                          searchPlaceholder="Search active employees…"
                          emptyMessage="No active employees match that search."
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
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
                  {(employee?.managerHierarchy?.additionalManagers ?? []).map((person, index) => (
                    <ChainRow
                      key={person.id}
                      index={MANAGER_LEVELS.length + index}
                      isLast={index === (employee?.managerHierarchy?.additionalManagers.length ?? 0) - 1}
                      label={`${ordinal(MANAGER_LEVELS.length + index + 1)} Level Manager`}
                      required={false}
                      hint="Further up the reporting line — not part of the appraisal review chain"
                    >
                      <div className="flex items-center gap-2.5 rounded-lg border p-2.5">
                        <Avatar size="sm">
                          {person.profilePhotoUrl && (
                            <AvatarImage src={photoUrl(person.profilePhotoUrl)} alt={person.fullName} />
                          )}
                          <AvatarFallback className="bg-role-hr/12 text-[10px] text-role-hr">
                            {initialsOf(person.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{person.fullName}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {person.designationTitle ?? person.employeeCode}
                          </p>
                        </div>
                      </div>
                    </ChainRow>
                  ))}
                </ol>
                <div className="grid gap-3 border-t pt-4">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Additional relationships — outside the review chain
                  </p>
                  {ADDITIONAL_MANAGER_RELATIONSHIPS.map((relationship) => {
                    const people = relationship.multiple
                      ? (employee?.managerHierarchy?.projectManagers ?? [])
                      : []

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
                      <div className="flex items-center gap-1.5">
                        <FormLabel>Work email</FormLabel>
                        <InfoTip label="Work email">
                          {employee?.user
                            ? `The address this employee signs in with. Changing it renames their account — they'll sign in with the new one, and it will need verifying again.${workEmailDomain ? ` Must end with @${workEmailDomain}.` : ""}`
                            : workEmailDomain
                              ? `Must end with @${workEmailDomain}. Leave blank if this employee needs no login. Otherwise they can sign in with this email and the password below as soon as you save — sending them the details is a separate step.`
                              : "Leave blank if this employee needs no login. Otherwise they can sign in with this email and the password below as soon as you save — sending them the details is a separate step."}
                        </InfoTip>
                      </div>
                      <FormControl>
                        {/* Editable at any time, including after an account
                            exists. Changing it renames that same account
                            rather than making a second one, so everything
                            attached to the person follows them — but it is
                            their LOGIN, so the new address starts unverified
                            and they sign in with it from then on. */}
                        <WorkEmailInput
                          // Fixed only while Settings has the domain check on;
                          // with it off this is a plain email box.
                          domain={workEmailDomain}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* The password set on this employee's account when the form is
                    saved. Saving only sets it — nothing is emailed and no
                    change is forced; that is the Send button on their page.
                    
                    On a NEW employee it is prefilled with a generated one: a
                    blank field invites somebody to type "Welcome123", and the
                    generated value is both stronger than what anyone would
                    choose and already correct, so the fast path and the safe
                    path are the same path.
                    
                    On an EDIT it starts empty, and that difference is
                    load-bearing — a prefilled value here would quietly reset
                    the person's password every time anyone corrected their
                    phone number. Empty means "leave it alone"; type or
                    generate one to actually change it. */}
                <div className="grid gap-2.5 rounded-lg border border-dashed p-3">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-1.5">
                          <FormLabel>{employee ? "New password" : "Password"}</FormLabel>
                          <InfoTip label="Password">
                            Saved as their password when you click Save. Nothing is emailed — send it
                            from the employee&apos;s page, where you also choose whether they must change it.
                          </InfoTip>
                        </div>
                        {/* Capped rather than stretched. A generated password
                            is 19 characters, so a field the width of the form
                            is mostly empty box — and the Generate button ends
                            up marooned at the far edge. */}
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 max-w-72 flex-1">
                            <FormControl>
                              <PasswordInput
                                {...field}
                                autoComplete="new-password"
                                placeholder={employee ? "Leave blank to keep the current one" : undefined}
                              />
                            </FormControl>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => form.setValue("password", generatePassword())}
                          >
                            <RefreshCwIcon className="size-3.5" /> Generate
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="employee-roles">Roles</Label>
                    <InfoTip label="Roles">
                      Every account gets the Employee role. Add HR or Admin on top to let this person
                      manage other employees.
                    </InfoTip>
                  </div>
                  <MultiSelect
                    id="employee-roles"
                    aria-label="Roles"
                    options={roleOptions}
                    value={selectedRoleIds}
                    onChange={(next) => {
                      form.setValue("roleIds", next)
                      // "A work email is needed before roles can be assigned"
                      // lives on the email field, so re-check it as roles change.
                      void form.trigger("workEmail")
                    }}
                    isLoading={rolesLoading}
                    searchable={false}
                    placeholder="Employee (default)"
                    emptyMessage="No roles defined yet."
                  />
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

          <FormSection title="Contact" subtitle="How to reach them personally">
            <PhoneListField form={form} />
            <div className="grid gap-3.5 sm:grid-cols-2">
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

          <FormSection title="Address" subtitle="Current residential address">
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
              {/* Country → State → City — see AddressLocationFields. */}
              <AddressLocationFields form={form} savedCountry={employee?.country} idPrefix="employee" />
              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal code</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(event) => field.onChange(digitsOnly(event.target.value))}
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="6 digits"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </FormSection>

          <FormSection title="Emergency contacts" subtitle="Who to reach in an emergency">
            <EmergencyContactsField form={form} />
          </FormSection>

          {showSensitive && (
            <>
              <FormSection title="Bank details" subtitle="Where their salary is paid">
                <BankDetailsFields form={form} />
              </FormSection>

              <FormSection
                title="Identity numbers"
                subtitle="Optional — the Aadhaar and PAN documents themselves go on the Documents tab"
              >
                <IdentityNumbersFields form={form} />
              </FormSection>
            </>
          )}
        </fieldset>
      </form>
    </Form>
  )
}

/**
 * The first message inside one field's errors, and the dotted name of the
 * input it belongs to — `phones.1`, `emergencyContacts.0.phone`. A plain field
 * is its own answer; a list field's errors are arrays/objects keyed by row.
 */
function firstFieldError(name: string, error: unknown): [string, string | undefined] {
  if (!error || typeof error !== "object") return [name, undefined]
  const message = (error as { message?: unknown }).message
  if (typeof message === "string") return [name, message]

  for (const [key, child] of Object.entries(error)) {
    if (key === "ref" || key === "type" || !child || typeof child !== "object") continue
    const found = firstFieldError(`${name}.${key}`, child)
    if (found[1]) return found
  }
  return [name, undefined]
}

/**
 * The work email. With the company domain check on (Settings), only the name part is
 * typed: the domain follows it, fixed, so the box reads as the whole address
 * ("priya@berylsystems.com") while holding it. A domain typed in as well
 * ("@gmail.com") is kept, not silently cut, and the form says why it can't be
 * saved; a pasted address on the company domain keeps just its name. With no
 * domain set — or an existing address on another domain, never rewritten
 * silently — it is a plain email box.
 */
function WorkEmailInput({
  domain,
  value,
  onChange,
  onBlur,
  name,
  ref,
  ...control
}: {
  domain: string | null
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  name: string
  ref?: Ref<HTMLInputElement>
  /** What FormControl passes down — the field's id and error wiring. */
  id?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}) {
  const suffix = domain ? `@${domain.toLowerCase()}` : null
  const onDomain = suffix !== null && (value === "" || value.toLowerCase().endsWith(suffix))

  if (!suffix || !onDomain) {
    return (
      <Input
        {...control}
        ref={ref}
        type="email"
        name={name}
        value={value}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
        placeholder={suffix ? `priya${suffix}` : "priya@company.com"}
      />
    )
  }

  const local = value.slice(0, value.length - suffix.length)
  return (
    <div className="relative flex h-8 w-full min-w-0 items-center rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 dark:bg-input/30">
      <MailIcon className="pointer-events-none ml-2.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="relative h-full min-w-0 flex-1">
        {/* The domain, drawn right after the typed name: an invisible copy of
            the name sets where it starts. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center overflow-hidden px-2 text-base whitespace-pre md:text-sm"
        >
          <span className="invisible">{local || "name"}</span>
          <span className="text-muted-foreground">{suffix}</span>
        </div>
        <input
          {...control}
          ref={ref}
          name={name}
          value={local}
          onBlur={onBlur}
          // Lower case, no spaces; letters, digits and . _ + - — plus "@",
          // which is kept so a typed domain shows (and is refused) rather than
          // being quietly merged into the name.
          onChange={(event) => {
            let next = event.target.value.toLowerCase().replace(/[^a-z0-9._+\-@]/g, "")
            if (next.endsWith(suffix)) next = next.slice(0, -suffix.length)
            onChange(next ? `${next}${suffix}` : "")
          }}
          placeholder="name"
          autoComplete="off"
          spellCheck={false}
          className="relative h-full w-full bg-transparent px-2 text-base outline-none placeholder:text-muted-foreground/70 md:text-sm"
        />
      </div>
    </div>
  )
}

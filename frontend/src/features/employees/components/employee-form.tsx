"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useForm, type FieldErrors } from "react-hook-form"
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
  PlusIcon,
  RefreshCwIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "cn"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select"
import { SearchSelect } from "@/components/ui/search-select"
import {
  Form,
  FormControl,
  FormField,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  buildEmployeeFormSchema,
  maxBirthDateIso,
  maxJoiningIso,
  todayIso,
  MAX_JOINING_DAYS_AHEAD,
  WORK_LOCATIONS,
  type EmployeeFormValues,
  type EmployeePayload,
} from "@/features/employees/schemas"
import { companySettingsApi, employeesApi } from "@/features/employees/api"
import { generatePassword } from "@/features/employees/generate-password"
import {
  useDepartments,
  useDesignations,
  useAssignableManagers,
  useRoles,
} from "@/features/employees/hooks/use-employees"
import {
  GENDER_OPTIONS,
  DEFAULT_EMPLOYEE_ROLE_SLUG,
  MANAGER_LEVELS,
  ADDITIONAL_MANAGER_RELATIONSHIPS,
  EMPLOYMENT_TYPES,
  OTHER_CITY,
} from "@/features/employees/constants"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS, roleBadgeClasses } from "@/constants/permissions"
import { API_ORIGIN } from "@/lib/api-client"
import type { Employee, EmployeeSummary, ReviewChainLevel } from "@/types/employees"
import { Country, State, City } from "country-state-city"

/** Base UI's Select wants {value,label} items; WORK_LOCATIONS is a plain list. */
const WORK_LOCATION_OPTIONS = WORK_LOCATIONS.map((value) => ({ value, label: value }))

/**
 * Country → State → City, from the `country-state-city` dataset.
 *
 * NAMES are stored, not ISO codes: the three columns are free text and were
 * free text before these dropdowns existed, so every address already on file
 * holds a name. Writing codes would make the new rows unreadable next to the
 * old ones. The codes are looked up on the way in instead.
 */
const COUNTRIES = Country.getAllCountries()

function isoForCountry(name: string) {
  return COUNTRIES.find((c) => c.name === name)?.isoCode ?? null
}

function statesOf(countryName: string) {
  const iso = isoForCountry(countryName)
  return iso ? State.getStatesOfCountry(iso) : []
}

function citiesOf(countryName: string, stateName: string) {
  const countryIso = isoForCountry(countryName)
  if (!countryIso) return []
  const stateIso = State.getStatesOfCountry(countryIso).find((st) => st.name === stateName)?.isoCode
  return stateIso ? City.getCitiesOfState(countryIso, stateIso) : []
}

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
  const [isEditing, setIsEditing] = useState(false)
  const assigned = useMemo(() => options.find((o) => o.value === value), [options, value])

  if (!value) {
    if (!isEditing) {
      return (
        <div className="flex items-center justify-between rounded-lg border border-dashed p-2.5">
          <span className="text-xs text-muted-foreground">Not assigned</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs font-medium"
            onClick={() => setIsEditing(true)}
          >
            Assign
          </Button>
        </div>
      )
    }

    return (
      <div className="grid gap-1.5">
        <SearchSelect
          id={id}
          aria-label={label}
          options={options}
          value={null}
          onChange={(next) => {
            onChange(next ?? "")
            setIsEditing(false)
          }}
          onSearchChange={onSearchChange}
          isLoading={isLoading}
          invalid={Boolean(error)}
          clearable={true}
          placeholder={`Select a ${label.toLowerCase()}`}
          searchPlaceholder="Search active employees…"
          emptyMessage="No active employees match that search."
        />
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => setIsEditing(false)}
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  if (isEditing) {
    return (
      <div className="grid gap-1.5">
        <SearchSelect
          id={id}
          aria-label={label}
          options={options}
          value={value}
          onChange={(next) => {
            onChange(next ?? "")
            setIsEditing(false)
          }}
          onSearchChange={onSearchChange}
          isLoading={isLoading}
          invalid={Boolean(error)}
          clearable={true}
          placeholder={`Select a ${label.toLowerCase()}`}
          searchPlaceholder="Search active employees…"
          emptyMessage="No active employees match that search."
        />
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => setIsEditing(false)}
          >
            Done
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              onChange("")
              setIsEditing(false)
            }}
          >
            Remove
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        {assigned?.adornment}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{assigned?.label ?? "Assigned manager"}</p>
          {assigned?.description && (
            <p className="truncate text-xs text-muted-foreground">{assigned.description}</p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs font-medium"
          onClick={() => setIsEditing(true)}
        >
          Change
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs font-medium text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onChange("")}
        >
          Remove
        </Button>
      </div>
    </div>
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

  const { data: roles, isLoading: rolesLoading } = useRoles(canManageRoles)
  const [managerSearch, setManagerSearch] = useState("")
  const { data: managerResults, isLoading: managersLoading } = useAssignableManagers(
    managerSearch,
    canManageManagers
  )

  const form = useForm<EmployeeFormValues>({
    // Built per mode: the joining-date and age windows are hiring rules and
    // must not fire on somebody who is already here — see the schema.
    resolver: zodResolver(buildEmployeeFormSchema({ isNew: !employee })),
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
      gender: (employee?.gender as EmployeeFormValues["gender"]) ?? "male",
      phone: employee?.phone ?? "",
      personalEmail: employee?.personalEmail ?? "",
      addressLine1: employee?.addressLine1 ?? "",
      addressLine2: employee?.addressLine2 ?? "",
      city: employee?.city ?? "",
      cityOther: "",
      state: employee?.state ?? "",
      postalCode: employee?.postalCode ?? "",
      country: employee?.country ?? "",
      emergencyContactName: employee?.emergencyContactName ?? "",
      emergencyContactPhone: employee?.emergencyContactPhone ?? "",
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

  // Country → State → City option lists. Each depends on the one above it, so
  // they are derived from the watched values rather than held in state — there
  // is no version of these lists that isn't a function of the current choice.
  const selectedCountry = form.watch("country") ?? ""
  const selectedState = form.watch("state") ?? ""
  const selectedCity = form.watch("city") ?? ""

  const countryOptions = useMemo(
    () => COUNTRIES.map((c) => ({ value: c.name, label: c.name })),
    []
  )
  const stateOptions = useMemo(
    () => statesOf(selectedCountry).map((st) => ({ value: st.name, label: st.name })),
    [selectedCountry]
  )
  const cityOptions = useMemo(
    () => [
      ...citiesOf(selectedCountry, selectedState).map((c) => ({ value: c.name, label: c.name })),
      // Always last, and always offered: the dataset is large but not complete,
      // and an address nobody can enter is worse than a free-text box.
      { value: OTHER_CITY, label: "Other (type it in)" },
    ],
    [selectedCountry, selectedState]
  )

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
    const [ name, error ] = Object.entries(errors)[0] ?? []
    const message = (error as { message?: string } | undefined)?.message

    toast.error(message ?? "Some details still need fixing before this can be saved.")
    if (name) {
      form.setFocus(name as keyof EmployeeFormValues)
      document
        .querySelector(`[name="${name}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" })
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
    if (workEmailDomain && values.workEmail && !values.workEmail.toLowerCase().endsWith(`@${workEmailDomain.toLowerCase()}`)) {
      form.setError("workEmail", { message: `Work email must end with @${workEmailDomain}` })
      return
    }

    // Mandatory on a NEW employee only. Applying it to an edit too would make
    // every legacy record without one unsaveable — you could not correct a
    // surname until you had also found somebody a manager — and the rule is
    // about who is being hired, not about who is already here.
    if (!employee && canManageManagers && !values.primaryManagerId) {
      form.setError("primaryManagerId", { message: "A 1st level manager is required" })
      return
    }

    const {
      currentLevel,
      primaryManagerId,
      secondaryManagerId,
      finalManagerId,
      projectManagerIds,
      additionalManagerIds,
      cityOther,
      roleIds,
      workEmail,
      password,
      ...rest
    } = values
    const payload: EmployeePayload = {
      ...rest,
      currentLevel: currentLevel || null,
      // "Other" is a prompt to type one, not a city anybody lives in.
      city: rest.city === OTHER_CITY ? cityOther?.trim() || null : rest.city,
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
                      <Input {...field} placeholder={suggestedCode?.employeeCode ?? "e.g. ACM-007"} />
                    </FormControl>
                    {/* Said out loud rather than left as a silently-filled
                        field: somebody who did not set the pattern should know
                        where the value came from before they save it. */}
                    {!employee && suggestedCode?.employeeCode && (
                      <FormDescription>
                        Suggested from your Initial ID setting. Edit it if you need something else.
                      </FormDescription>
                    )}
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
                      {/* The calendar itself stops at the 22nd birthday, so a
                          date that would be refused can't be picked at all.
                          The zod rule still runs — `max` is advisory in a
                          typed-in date, and the server decides regardless. */}
                      {/* Capped for a NEW hire only. On an existing record the
                          cap would make their own stored date unpickable. */}
                      <Input type="date" max={employee ? undefined : maxBirthDateIso()} {...field} />
                    </FormControl>
                    <FormMessage />
                    {!employee && <FieldHint>Employees must be at least 22 years old.</FieldHint>}
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
              <div className="grid gap-1.5">
                <Label htmlFor="employee-work-location">Work location</Label>
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
                <FieldHint>Faridabad is the head office and the default.</FieldHint>
              </div>
              <FormField
                control={form.control}
                name="dateOfJoining"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of joining</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        min={employee ? undefined : todayIso()}
                        max={employee ? undefined : maxJoiningIso()}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                    {!employee && (
                      <FieldHint>
                        Today, or any date in the next {MAX_JOINING_DAYS_AHEAD} days.
                      </FieldHint>
                    )}
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
                      <Label htmlFor={`employee-${relationship.value}`}>{relationship.label}</Label>
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
                        {/* Editable at any time, including after an account
                            exists. Changing it renames that same account
                            rather than making a second one, so everything
                            attached to the person follows them — but it is
                            their LOGIN, so the new address starts unverified
                            and they sign in with it from then on. */}
                        <Input
                          type="email"
                          {...field}
                          placeholder={workEmailDomain ? `priya@${workEmailDomain}` : "priya@company.com"}
                        />
                      </FormControl>
                      <FormMessage />
                      <FieldHint>
                        {employee?.user
                          ? `The address this employee signs in with. Changing it renames their account — they'll sign in with the new one, and it will need verifying again.${workEmailDomain ? ` Must end with @${workEmailDomain}.` : ""}`
                          : workEmailDomain
                            ? `Must end with @${workEmailDomain}. Leave blank if this employee needs no login — otherwise they get an email to set their own password, and no password is ever set here.`
                            : "Leave blank if this employee needs no login. Otherwise they get an email to set their own password — no password is ever set here."}
                      </FieldHint>
                    </FormItem>
                  )}
                />

                {/* The password this employee will be emailed.
                    
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
                        <FormLabel>{employee ? "New password" : "Password"}</FormLabel>
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
                      <Input type="tel" {...field} placeholder="98765 43210" />
                    </FormControl>
                    <FormMessage />
                    <FieldHint>Indian mobile number, with or without +91.</FieldHint>
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
              {/* Country first, then State, then City: each list is derived
                  from the one above it, so choosing out of order would offer
                  nothing. Changing a level clears the levels below rather than
                  leaving a city that no longer belongs to its state. */}
              <div className="grid gap-1.5">
                <Label htmlFor="employee-country">Country</Label>
                <SearchSelect
                  id="employee-country"
                  aria-label="Country"
                  options={countryOptions}
                  value={form.watch("country") || null}
                  onChange={(next) => {
                    form.setValue("country", next ?? "")
                    form.setValue("state", "")
                    form.setValue("city", "")
                    form.setValue("cityOther", "")
                  }}
                  clearable
                  placeholder="Select a country"
                  searchPlaceholder="Search countries…"
                  emptyMessage="No country matches that search."
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="employee-state">State</Label>
                <SearchSelect
                  id="employee-state"
                  aria-label="State"
                  options={stateOptions}
                  value={form.watch("state") || null}
                  onChange={(next) => {
                    form.setValue("state", next ?? "")
                    form.setValue("city", "")
                    form.setValue("cityOther", "")
                  }}
                  clearable
                  placeholder={selectedCountry ? "Select a state" : "Choose a country first"}
                  searchPlaceholder="Search states…"
                  emptyMessage="No state matches that search."
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="employee-city">City</Label>
                <SearchSelect
                  id="employee-city"
                  aria-label="City"
                  options={cityOptions}
                  value={form.watch("city") || null}
                  onChange={(next) => {
                    form.setValue("city", next ?? "")
                    if (next !== OTHER_CITY) form.setValue("cityOther", "")
                  }}
                  clearable
                  placeholder={selectedState ? "Select a city" : "Choose a state first"}
                  searchPlaceholder="Search cities…"
                  emptyMessage="No city matches that search."
                />
                {selectedCity === OTHER_CITY && (
                  <FormField
                    control={form.control}
                    name="cityOther"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input {...field} placeholder="Type the city name" aria-label="City name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal code</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
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
                      <Input type="tel" {...field} placeholder="98765 43210" />
                    </FormControl>
                    <FormMessage />
                    <FieldHint>Indian mobile number, with or without +91.</FieldHint>
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

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useForm, useWatch, type FieldErrors } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ImageUpIcon, LockIcon, Trash2Icon, TriangleAlertIcon, UserPenIcon } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PanelBody, PanelFooter, PanelHeader, PanelSection } from "@/components/ui/panel"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { InfoTip } from "@/components/ui/tooltip"
import {
  AddressLocationFields,
  DEFAULT_COUNTRY,
} from "@/features/employees/components/address-location-fields"
import {
  BankDetailsFields,
  EmergencyContactsField,
  IdentityNumbersFields,
  PhoneListField,
} from "@/features/employees/components/personal-detail-fields"
import { formatAadhaar } from "@/features/employees/components/sensitive-field"
import { GENDER_OPTIONS, OTHER_CITY } from "@/features/employees/constants"
import { digitsOnly } from "@/features/employees/input-format"
import { useUpdateOwnProfile, type ProfileUpdate } from "@/features/employees/hooks/use-employee-mutations"
import {
  buildProfileFormSchema,
  emergencyContactsPayload,
  identityNumbersPayload,
  maxBirthDateIso,
  phonesPayload,
  savedPersonalDetails,
  type ProfileFormValues,
  type ProfilePayload,
} from "@/features/employees/schemas"
import { API_ORIGIN } from "@/lib/api-client"
import type { Employee } from "@/types/employees"

/** Mirrors Employee::PROFILE_PHOTO_TYPES / PROFILE_PHOTO_MAX_BYTES. */
export const PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"]
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024

/** What happens to the photo on Save: nothing, a new one, or none at all. */
type PhotoChange = { kind: "keep" } | { kind: "upload"; file: File } | { kind: "remove" }

/**
 * The employee's own Edit profile, in the side panel — opened from /profile.
 *
 * Only the personal details they may change themselves (the server's
 * Employee::SELF_EDITABLE_FIELDS, plus the photo). Their name, ID, job,
 * managers and access are HR's, and aren't on this form at all — the server
 * would ignore them if they were. Saved straight away, with every change
 * written to their History for Admin/HR to see.
 */
export function EditProfileSheet({
  employee,
  open,
  onOpenChange,
}: {
  employee: Employee
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const updateProfile = useUpdateOwnProfile()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:w-[45vw] sm:max-w-275 sm:min-w-180"
      >
        <PanelHeader
          icon={UserPenIcon}
          title="Edit profile"
          description="Your contact, address, emergency, bank and identity details. Saved as soon as you save."
        />
        <PanelBody>
          {/* Mounted per opening, so it starts from what is on file now rather
              than from whatever was typed and abandoned last time. */}
          {open && (
            <ProfileForm
              employee={employee}
              isPending={updateProfile.isPending}
              onSubmit={(update) => updateProfile.mutate(update, { onSuccess: () => onOpenChange(false) })}
              onNothingToSave={() => onOpenChange(false)}
            />
          )}
        </PanelBody>
        <PanelFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="profile-form"
            disabled={updateProfile.isPending}
            className="gap-1.5 bg-role-hr text-role-hr-foreground shadow-2xs hover:bg-role-hr/90"
          >
            <UserPenIcon className="size-4" />
            {updateProfile.isPending ? "Saving…" : "Save changes"}
          </Button>
        </PanelFooter>
      </SheetContent>
    </Sheet>
  )
}

/** The form values for what is on file — "" for every blank, one empty row per empty list. */
function profileDefaults(employee: Employee): ProfileFormValues {
  const saved = savedPersonalDetails(employee)
  return {
    employeeCode: employee.employeeCode ?? "",
    phones: saved.phones.length ? saved.phones : [""],
    personalEmail: employee.personalEmail ?? "",
    gender: employee.gender === "female" ? "female" : "male",
    dateOfBirth: employee.dateOfBirth ?? "",
    celebrationDate: employee.celebrationDate ?? "",
    addressLine1: employee.addressLine1 ?? "",
    addressLine2: employee.addressLine2 ?? "",
    city: employee.city ?? "",
    cityOther: "",
    state: employee.state ?? "",
    postalCode: employee.postalCode ?? "",
    country: employee.country || DEFAULT_COUNTRY,
    emergencyContacts: saved.emergencyContacts.length
      ? saved.emergencyContacts
      : [{ name: "", relation: "", phone: "" }],
    bankAccountNumber: employee.bankAccountNumber ?? "",
    bankAccountHolderName: employee.bankAccountHolderName ?? "",
    bankIfscCode: employee.bankIfscCode ?? "",
    aadhaarNumber: formatAadhaar(employee.aadhaarNumber ?? ""),
    panNumber: employee.panNumber ?? "",
    otherIdentityNumbers: (employee.otherIdentityNumbers ?? []).map((r) => ({ label: r.label ?? "", number: r.number ?? "" })),
  }
}

/** The plain text fields, sent as typed when they differ from what's on file. */
const TEXT_FIELDS = [
  "employeeCode",
  "personalEmail",
  "gender",
  "dateOfBirth",
  "celebrationDate",
  "addressLine1",
  "addressLine2",
  "postalCode",
  "bankAccountNumber",
  "bankAccountHolderName",
  "bankIfscCode",
  "panNumber",
] as const

/**
 * Only what CHANGED, compared against what the form opened with.
 *
 * Every field the API receives is a History entry if it differs from the
 * stored value, and a stored value can differ from its own round trip (a
 * phone saved as "+91 98100 10005" comes back normalised). Sending only real
 * edits keeps the History to the things the employee actually did.
 */
function changedFields(values: ProfileFormValues, initial: ProfileFormValues): ProfilePayload | null {
  const payload: ProfilePayload = {}
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

  for (const key of TEXT_FIELDS) {
    if (values[key] !== initial[key]) payload[key] = values[key]
  }
  if (values.aadhaarNumber !== initial.aadhaarNumber) payload.aadhaarNumber = values.aadhaarNumber.replace(/\s/g, "")

  const phones = phonesPayload(values.phones)
  if (!same(phones, phonesPayload(initial.phones))) payload.phones = phones

  const contacts = emergencyContactsPayload(values.emergencyContacts)
  if (!same(contacts, emergencyContactsPayload(initial.emergencyContacts))) payload.emergencyContacts = contacts

  const identities = identityNumbersPayload(values.otherIdentityNumbers)
  if (!same(identities, identityNumbersPayload(initial.otherIdentityNumbers))) payload.otherIdentityNumbers = identities

  // Country, state and city are chosen together — changing the country clears
  // the other two — so they travel together too. "Other" is a prompt to type
  // one, not a city anybody lives in.
  const location = ["country", "state", "city", "cityOther"] as const
  if (location.some((key) => values[key] !== initial[key])) {
    payload.country = values.country
    payload.state = values.state
    payload.city = values.city === OTHER_CITY ? values.cityOther?.trim() || null : values.city
  }

  return Object.keys(payload).length ? payload : null
}

function ProfileForm({
  employee,
  isPending,
  onSubmit,
  onNothingToSave,
}: {
  employee: Employee
  isPending: boolean
  onSubmit: (update: ProfileUpdate) => void
  onNothingToSave: () => void
}) {
  const initial = useMemo(() => profileDefaults(employee), [employee])
  const form = useForm<ProfileFormValues>({
    // Live, like the employee form: a mistake shows under its field as typed.
    mode: "all",
    resolver: zodResolver(
      buildProfileFormSchema({ saved: savedPersonalDetails(employee), savedDateOfBirth: employee.dateOfBirth })
    ),
    defaultValues: initial,
  })
  const [photo, setPhoto] = useState<PhotoChange>({ kind: "keep" })
  const gender = useWatch({ control: form.control, name: "gender" })

  function handleSubmit(values: ProfileFormValues) {
    const update: ProfileUpdate = {
      values: changedFields(values, initial),
      photo: photo.kind === "keep" ? null : photo,
    }
    if (!update.values && !update.photo) {
      toast.info("Nothing to save — no changes were made.")
      onNothingToSave()
      return
    }
    onSubmit(update)
  }

  // Names the first problem, as the employee form does — a failed check on a
  // field scrolled out of view otherwise looks like Save doing nothing.
  function reportInvalid(errors: FieldErrors<ProfileFormValues>) {
    const count = Object.keys(errors).length
    toast.error("Some details still need fixing before this can be saved.", {
      description: count > 1 ? `${count} fields need fixing.` : undefined,
    })
    document.querySelector("[aria-invalid='true']")?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  return (
    <Form {...form}>
      <form
        id="profile-form"
        onSubmit={form.handleSubmit(handleSubmit, reportInvalid)}
        className="grid gap-3"
        noValidate
      >
        <fieldset disabled={isPending} className="grid gap-3">
          <PanelSection title="Photo">
            <PhotoField employee={employee} change={photo} onChange={setPhoto} disabled={isPending} />
          </PanelSection>

          <PanelSection title="Personal info">
            <FormField
              control={form.control}
              name="employeeCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee ID</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <PhoneListField form={form} />
            <div className="grid items-start gap-3.5 sm:grid-cols-2">
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
              <div className="grid gap-1.5">
                <Label htmlFor="profile-gender">Gender</Label>
                <Select
                  items={GENDER_OPTIONS}
                  value={gender}
                  onValueChange={(v) => v && form.setValue("gender", v as ProfileFormValues["gender"])}
                >
                  <SelectTrigger id="profile-gender" className="h-9 w-full">
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
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of birth</FormLabel>
                    <FormControl>
                      <DatePicker max={maxBirthDateIso()} placeholder="dd/mm/yyyy" clearable {...field} />
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
                        Optional — a day you celebrate that isn&apos;t your date of birth.
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
          </PanelSection>

          <PanelSection title="Address">
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
            <div className="grid items-start gap-3.5 sm:grid-cols-2">
              <AddressLocationFields form={form} savedCountry={employee.country} idPrefix="profile" />
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
          </PanelSection>

          <PanelSection title="Emergency contacts" description="Who to reach in an emergency">
            <EmergencyContactsField form={form} />
          </PanelSection>

          <PanelSection title="Bank details" description="Visible only to you and Admin/HR">
            <BankDetailsFields form={form} />
          </PanelSection>

          <PanelSection
            title="Identity numbers"
            description="Visible only to you and Admin/HR. Your Aadhaar and PAN documents still go on the Documents tab."
          >
            <IdentityNumbersFields form={form} />
          </PanelSection>

          <p className="flex items-start gap-1.5 rounded-lg bg-muted/60 px-2.5 py-2 text-xs text-muted-foreground">
            <LockIcon className="mt-px size-3.5 shrink-0" />
            <span>
              Your name, employee ID, work email, job details, managers and roles are managed by Admin or HR.
            </span>
          </p>
        </fieldset>
      </form>
    </Form>
  )
}

/**
 * The profile photo: a preview of what it will be after Save, with Choose /
 * Replace and Remove. Nothing is uploaded until Save — choosing a file only
 * stages it, so Cancel really does leave the old photo in place.
 */
function PhotoField({
  employee,
  change,
  onChange,
  disabled,
}: {
  employee: Employee
  change: PhotoChange
  onChange: (change: PhotoChange) => void
  disabled: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Each preview URL is released when it is replaced, and on the way out.
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview)
    },
    [preview]
  )

  const current = employee.profilePhotoUrl ? `${API_ORIGIN}${employee.profilePhotoUrl}` : null
  const shown = change.kind === "upload" ? preview : change.kind === "remove" ? null : current
  const initials = `${employee.firstName[0] ?? ""}${employee.lastName[0] ?? ""}`.toUpperCase()

  function choose(file: File | undefined) {
    if (!file) return
    if (!PHOTO_TYPES.includes(file.type)) {
      setError("Photo must be a PNG, JPG or WebP image.")
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Photo must be 2 MB or smaller.")
      return
    }
    setError(null)
    setPreview(URL.createObjectURL(file))
    onChange({ kind: "upload", file })
  }

  function remove() {
    setError(null)
    setPreview(null)
    // Removing a photo that was only staged goes back to the one on file;
    // removing the one on file is the actual removal.
    onChange(change.kind === "upload" ? { kind: "keep" } : { kind: "remove" })
  }

  return (
    <div className="grid gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={PHOTO_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          choose(event.target.files?.[0])
          // Lets the same file be picked again after a Remove.
          event.target.value = ""
        }}
      />
      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="size-20">
          {shown && <AvatarImage src={shown} alt="Profile photo" />}
          <AvatarFallback className="bg-role-hr/12 text-xl text-role-hr">{initials}</AvatarFallback>
        </Avatar>
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <ImageUpIcon className="size-4" />
              {shown ? "Replace photo" : "Choose photo"}
            </Button>
            {shown && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground hover:text-destructive"
                disabled={disabled}
                onClick={remove}
              >
                <Trash2Icon className="size-4" />
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {change.kind === "remove"
              ? "Your photo will be removed when you save."
              : change.kind === "upload"
                ? "New photo — uploaded when you save."
                : "PNG, JPG or WebP, up to 2 MB."}
          </p>
        </div>
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
          <TriangleAlertIcon className="size-3.5" /> {error}
        </p>
      )}
    </div>
  )
}

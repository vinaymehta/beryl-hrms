import { z } from "zod"

import type { EmployeeLevel } from "@/types/employees"

const EMPLOYEE_LEVEL_VALUES = ["intern", "junior", "senior", "lead", "manager"] as const

/**
 * The joining rules, mirrored from the server so the form can refuse bad input
 * before a round trip. Every one of these is ALSO enforced in Employee — these
 * are for the person typing, not for correctness; the server is what decides.
 */
export const MINIMUM_AGE_YEARS = 22
export const MAX_JOINING_DAYS_AHEAD = 30
/** How far back a joining date may go — for recording people who joined long ago. */
export const MAX_JOINING_YEARS_BACK = 50
export const GENDERS = ["male", "female"] as const
export const WORK_LOCATIONS = ["Faridabad", "Delhi", "Gurgaon"] as const
/** +91 optional, then a ten-digit Indian mobile. Punctuation is stripped first. */
const INDIAN_PHONE = /^(?:\+?91)?[6-9]\d{9}$/
const isIndianPhone = (value: string) => INDIAN_PHONE.test(value.replace(/[\s()-]/g, ""))
const PHONE_MESSAGE = "Enter a valid Indian mobile number"

/** Caps mirrored from Employee::MAX_PHONES / MAX_EMERGENCY_CONTACTS. */
export const MAX_PHONES = 5
export const MAX_EMERGENCY_CONTACTS = 5

/**
 * The issuers' formats, mirrored from Employee. Case-insensitive here because
 * the inputs upper-case as they go and the server stores upper-case anyway.
 */
const IFSC_CODE = /^[A-Z]{4}0[A-Z0-9]{6}$/i
const BANK_ACCOUNT_NUMBER = /^\d{9,18}$/
const AADHAAR_NUMBER = /^\d{12}$/
const PAN_NUMBER = /^[A-Z]{5}\d{4}[A-Z]$/i

/** An optional text field that, when filled, must match `pattern`. */
const optionalMatching = (pattern: RegExp, message: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || pattern.test(v), { message })

const emergencyContactEntry = z.object({
  name: z.string(),
  relation: z.string(),
  phone: z.string(),
})
export type EmergencyContactValues = z.infer<typeof emergencyContactEntry>

/**
 * The personal half of an employee — everything the employee may also edit
 * about themselves from Profile. Shared by HR's full form (which adds the job,
 * manager and access fields on top) and the self-service profile form, so the
 * two can never disagree about what a valid phone number or PAN is.
 */
/** Mirrors Employee::MAX_OTHER_IDENTITY_NUMBERS. */
export const MAX_OTHER_IDENTITY_NUMBERS = 10
/** Mirrors the number format Employee checks: letters, digits, spaces, - and /. */
const IDENTITY_NUMBER = /^[A-Z0-9][A-Z0-9 /-]{0,39}$/

const identityNumberEntry = z.object({ label: z.string(), number: z.string() })
export type IdentityNumberValues = z.infer<typeof identityNumberEntry>

const personalDetailFields = z.object({
  dateOfBirth: z.string().optional().or(z.literal("")),
  celebrationDate: z.string().optional().or(z.literal("")),
  gender: z.enum(GENDERS),
  /**
   * The employee's own numbers, main one first. A "" entry is a row somebody
   * added and hasn't filled in; it is dropped on submit, never sent. Checked
   * row by row in refinePersonalDetails, not here — see there for why.
   */
  phones: z.array(z.string()),
  personalEmail: z.string().email("Enter a valid email address").optional().or(z.literal("")),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  /** Only used when city is "Other" — see the address section of the form. */
  cityOther: z.string().optional(),
  state: z.string().optional(),
  postalCode: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{6}$/.test(v), { message: "Postal code must be exactly 6 digits" })
    .optional()
    .or(z.literal("")),
  country: z.string().optional(),
  /** As `phones`: an all-blank row is dropped on submit rather than checked. */
  emergencyContacts: z.array(emergencyContactEntry),
  bankAccountNumber: optionalMatching(BANK_ACCOUNT_NUMBER, "Account number must be 9 to 18 digits"),
  bankAccountHolderName: z.string().trim(),
  bankIfscCode: optionalMatching(IFSC_CODE, "IFSC must be 4 letters, a 0, then 6 letters or digits"),
  // Typed in groups of four, as printed on the card; the spaces are dropped
  // before checking (and again on the server, which stores the digits).
  aadhaarNumber: z
    .string()
    .trim()
    .refine((v) => v === "" || AADHAAR_NUMBER.test(v.replace(/\s/g, "")), {
      message: "Aadhaar number must be exactly 12 digits",
    }),
  panNumber: optionalMatching(PAN_NUMBER, "PAN must be 5 letters, 4 digits, then 1 letter"),
  /** Further identity documents. As `emergencyContacts`: an all-blank row is dropped on submit. */
  otherIdentityNumbers: z.array(identityNumberEntry),
})
export type PersonalDetailValues = z.infer<typeof personalDetailFields>

/** What is already on file, so rows carried over unchanged aren't re-judged. */
export interface SavedPersonalDetails {
  phones: string[]
  emergencyContacts: EmergencyContactValues[]
}

const sameContact = (a: EmergencyContactValues, b: EmergencyContactValues) =>
  a.name.trim() === b.name.trim() && a.relation.trim() === b.relation.trim() && a.phone.trim() === b.phone.trim()

/**
 * The phone and emergency-contact rules, row by row.
 *
 * Only a NEW or EDITED row is held to them — the same rule Employee applies on
 * the server. Numbers stored before the Indian-mobile rule existed (there are
 * some) would otherwise make the whole profile unsaveable the moment anybody
 * corrected an unrelated field, and the failing row would be one they never
 * touched.
 */
function refinePersonalDetails(values: PersonalDetailValues, ctx: z.RefinementCtx, saved: SavedPersonalDetails) {
  const phones = values.phones.map((p) => p.trim()).filter(Boolean)
  if (phones.length > MAX_PHONES) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["phones"], message: `At most ${MAX_PHONES} phone numbers` })
  }
  values.phones.forEach((raw, index) => {
    const phone = raw.trim()
    if (phone === "" || saved.phones.includes(phone) || isIndianPhone(phone)) return
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["phones", index], message: PHONE_MESSAGE })
  })

  const contacts = values.emergencyContacts.filter((c) => c.name.trim() || c.relation.trim() || c.phone.trim())
  if (contacts.length > MAX_EMERGENCY_CONTACTS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["emergencyContacts"],
      message: `At most ${MAX_EMERGENCY_CONTACTS} emergency contacts`,
    })
  }
  const identities = values.otherIdentityNumbers.filter((r) => r.label.trim() || r.number.trim())
  if (identities.length > MAX_OTHER_IDENTITY_NUMBERS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["otherIdentityNumbers"],
      message: `At most ${MAX_OTHER_IDENTITY_NUMBERS} identity numbers`,
    })
  }
  values.otherIdentityNumbers.forEach((row, index) => {
    const label = row.label.trim()
    const number = row.number.trim().toUpperCase()
    if (!label && !number) return
    if (!label) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["otherIdentityNumbers", index, "label"], message: "Document name is required" })
    else if (label.length > 50) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["otherIdentityNumbers", index, "label"], message: "At most 50 characters" })
    if (!number) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["otherIdentityNumbers", index, "number"], message: "Number is required" })
    else if (!IDENTITY_NUMBER.test(number)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["otherIdentityNumbers", index, "number"], message: "Letters, digits, spaces, - and / only (at most 40)" })
    }
  })

  values.emergencyContacts.forEach((contact, index) => {
    const blank = !contact.name.trim() && !contact.relation.trim() && !contact.phone.trim()
    if (blank || saved.emergencyContacts.some((s) => sameContact(s, contact))) return

    if (!contact.name.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["emergencyContacts", index, "name"], message: "Name is required" })
    }
    if (!contact.phone.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["emergencyContacts", index, "phone"], message: "Phone is required" })
    } else if (!isIndianPhone(contact.phone.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["emergencyContacts", index, "phone"], message: PHONE_MESSAGE })
    }
  })
}

/** The form rows for what an employee record holds — "" for every null. */
export function savedPersonalDetails(employee?: {
  phones: string[]
  emergencyContacts: { name: string | null; relation: string | null; phone: string | null }[]
}): SavedPersonalDetails {
  return {
    phones: employee?.phones ?? [],
    emergencyContacts: (employee?.emergencyContacts ?? []).map((c) => ({
      name: c.name ?? "",
      relation: c.relation ?? "",
      phone: c.phone ?? "",
    })),
  }
}

/** The rows worth sending: blank phones and all-blank contacts dropped, every value trimmed. */
export function phonesPayload(phones: string[]) {
  return phones.map((p) => p.trim()).filter(Boolean)
}

/** Identity rows worth sending: trimmed, number upper-cased, all-blank rows dropped. */
export function identityNumbersPayload(rows: IdentityNumberValues[]) {
  return rows
    .map((r) => ({ label: r.label.trim(), number: r.number.trim().toUpperCase() }))
    .filter((r) => r.label || r.number)
}

export function emergencyContactsPayload(contacts: EmergencyContactValues[]) {
  return contacts
    .map((c) => ({ name: c.name.trim(), relation: c.relation.trim(), phone: c.phone.trim() }))
    .filter((c) => c.name || c.relation || c.phone)
}

/** The latest DOB that still makes somebody old enough to be added. */
export function minimumBirthDate(today = new Date()) {
  const d = new Date(today)
  d.setFullYear(d.getFullYear() - MINIMUM_AGE_YEARS)
  return d
}

// Local calendar date, not toISOString(): that is the UTC date, which in India
// is still yesterday until 05:30 — and disagreed with the date picker's "today".
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
export const todayIso = () => isoDate(new Date())
export const minJoiningIso = () => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - MAX_JOINING_YEARS_BACK)
  return isoDate(d)
}
export const maxJoiningIso = () => {
  const d = new Date()
  d.setDate(d.getDate() + MAX_JOINING_DAYS_AHEAD)
  return isoDate(d)
}
export const maxBirthDateIso = () => isoDate(minimumBirthDate())

/**
 * The form's rules, built for one MODE.
 *
 * The date windows — joining within the last 50 years up to +30 days, and a 22nd birthday already past
 * — are HIRING rules. They describe somebody being taken on, so they apply
 * when adding a person and not when editing one who is already here: half the
 * directory joined last year, and applying the window to them makes their
 * record unsaveable. Correcting a surname would fail on a date nobody touched,
 * and because the offending field is off-screen it fails silently — Save
 * simply does nothing.
 *
 * Employee scopes the same rules to the field actually CHANGING
 * (`if: :will_save_change_to_date_of_joining?`), so the two agree.
 */
export function buildEmployeeFormSchema({
  isNew,
  workEmailDomain = () => null,
  saved = savedPersonalDetails(),
}: {
  isNew: boolean
  /**
   * A getter, not a value: the domain is fetched, so it is usually not known
   * yet when the form builds this schema. Read at validation time instead.
   */
  workEmailDomain?: () => string | null
  /** The phones and contacts already on file — see refinePersonalDetails. */
  saved?: SavedPersonalDetails
}) {
  return baseEmployeeFields
    .superRefine((values, ctx) => refinePersonalDetails(values, ctx, saved))
    .superRefine((values, ctx) => {
      // Worded identically to Employees::AccountProvisioner#reject_foreign_domain.
      const domain = workEmailDomain()
      if (domain && values.workEmail && !values.workEmail.toLowerCase().endsWith(`@${domain.toLowerCase()}`)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["workEmail"],
          message: `Work email must end with @${domain}`,
        })
      }
    })
    .superRefine((values, ctx) => {
      if (!isNew) return

      if (values.dateOfJoining && (values.dateOfJoining < minJoiningIso() || values.dateOfJoining > maxJoiningIso())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dateOfJoining"],
          message: `Joining date must be within the last ${MAX_JOINING_YEARS_BACK} years or the next ${MAX_JOINING_DAYS_AHEAD} days`,
        })
      }
      if (values.dateOfBirth && values.dateOfBirth > maxBirthDateIso()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dateOfBirth"],
          message: `Employees must be at least ${MINIMUM_AGE_YEARS} years old`,
        })
      }
    })
    .refine((values) => values.roleIds.length === 0 || values.workEmail !== "", {
      // Mirrors Employees::AccountProvisioner::Error — caught here so it reads
      // as a field error on the email rather than a toast after a round trip.
      message: "A work email is needed before roles can be assigned",
      path: ["workEmail"],
    })
    .refine(
      (values) =>
        (values.secondaryManagerId === "" && values.finalManagerId === "") ||
        values.primaryManagerId !== "",
      {
        // Mirrors Employee::ManagerHierarchyError. The 1st level manager
        // anchors the chain — neither of the other two slots stands without it.
        message: "Assign a 1st level manager first",
        path: ["primaryManagerId"],
      }
    )
}

const baseEmployeeFields = personalDetailFields.extend({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  employeeCode: z.string().trim().min(1, "Employee ID is required"),
  departmentId: z.string().optional(),
  /** The designation (within the chosen department). */
  designationId: z.string().optional(),
  currentLevel: z.enum(EMPLOYEE_LEVEL_VALUES).optional().or(z.literal("")),
  employmentTypeId: z.string().optional(),
  workLocation: z.enum(WORK_LOCATIONS),
  // Employee → Primary Manager → (optional) Secondary Manager → Final Manager.
  // One field per typed slot, each an employee id or "" for unassigned. Not
  // required at the zod level even though a complete hierarchy carries Primary
  // and Final — see MANAGER_LEVELS in ./constants for why.
  primaryManagerId: z.string(),
  secondaryManagerId: z.string(),
  finalManagerId: z.string(),
  // Outside the review chain, so not subject to the "needs a primary first"
  // rule below. Department Head was removed from this form; the column and its
  // existing assignments are untouched.
  projectManagerIds: z.array(z.string()),
  /**
   * The 4th reporting level and beyond, in the order they were added — the
   * position IS the tier, so this is never sorted. Blank entries are the
   * rows a user added and hasn't filled in yet; they're dropped on submit.
   */
  additionalManagerIds: z.array(z.string()),
  /**
   * Drives the login account. Leaving it blank is valid and means "no system
   * access" — not every employee needs one. The backend never sets or returns
   * a password; it emails a setup link instead.
   */
  workEmail: z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (!value) return
      // Two "@"s: a domain typed into the name part, in front of the company
      // domain the field adds itself.
      if ((value.match(/@/g) ?? []).length > 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Type only the name — the domain is added for you" })
      } else if (!z.string().email().safeParse(value).success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid work email" })
      }
    })
    .optional()
    .or(z.literal("")),
  /**
   * Role ids on the linked User account. The backend always adds the Employee
   * role on top of whatever is sent here, so an empty array is still a valid
   * "just the default" choice.
   */
  // No `.default([])`: a zod default makes the schema's INPUT type differ from
  // its output, and react-hook-form then refuses the resolver outright. The
  // empty array is supplied as a form defaultValue instead.
  roleIds: z.array(z.string()),
  /**
   * The password this employee will be emailed.
   *
   * Prefilled with a generated one, so it is normally not blank. Clearing it
   * is allowed and means "let the server generate one" — either way a password
   * is issued, because there is no link flow to fall back to any more.
   *
   * Whether its owner must replace it at first sign-in is NOT decided here.
   * That control sits beside the Send button on the employee's own page, and
   * omitting it lets the server apply its default, which is to require one.
   */
  password: z
    .string()
    .refine((v) => v === "" || v.length >= 8, { message: "Password must be at least 8 characters" })
    .optional()
    .or(z.literal("")),
  // Unconstrained in the base: the window is added for a NEW employee only
  // — see buildEmployeeFormSchema. Date of birth and the rest of the personal
  // details come from personalDetailFields.
  dateOfJoining: z.string().optional().or(z.literal("")),
})

/** The add-employee rules. An edit uses buildEmployeeFormSchema({isNew:false}). */
export const employeeFormSchema = buildEmployeeFormSchema({ isNew: true })
export type EmployeeFormValues = z.infer<typeof baseEmployeeFields>

/**
 * The employee's own Edit profile form — the personal fields and nothing else
 * (the server's Employee::SELF_EDITABLE_FIELDS). The age rule applies only to
 * a date of birth they CHANGE, as on the server, so a record that predates the
 * rule stays saveable.
 */
export function buildProfileFormSchema({
  saved,
  savedDateOfBirth,
}: {
  saved: SavedPersonalDetails
  savedDateOfBirth: string | null
}) {
  return personalDetailFields
    // The employee may correct their own employee ID, for now.
    .extend({ employeeCode: z.string().trim().min(1, "Employee ID is required") })
    .superRefine((values, ctx) => refinePersonalDetails(values, ctx, saved))
    .superRefine((values, ctx) => {
      const changed = values.dateOfBirth && values.dateOfBirth !== (savedDateOfBirth ?? "")
      if (changed && values.dateOfBirth! > maxBirthDateIso()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dateOfBirth"],
          message: `Date of birth must be at least ${MINIMUM_AGE_YEARS} years ago`,
        })
      }
    })
}
export type ProfileFormValues = PersonalDetailValues & { employeeCode: string }

/**
 * What the profile form sends to PATCH /employees/me: only the fields that
 * changed, with the lists flattened to the rows worth keeping. Everything is
 * optional because an untouched field is left out rather than re-sent.
 */
export interface ProfilePayload {
  employeeCode?: string
  phones?: string[]
  personalEmail?: string
  gender?: string
  dateOfBirth?: string
  celebrationDate?: string
  addressLine1?: string
  addressLine2?: string
  city?: string | null
  state?: string
  postalCode?: string
  country?: string
  emergencyContacts?: EmergencyContactValues[]
  bankAccountNumber?: string
  bankAccountHolderName?: string
  bankIfscCode?: string
  aadhaarNumber?: string
  panNumber?: string
  otherIdentityNumbers?: IdentityNumberValues[]
}

export const departmentFormSchema = z.object({
  name: z.string().trim().min(1, "Department name is required"),
  description: z.string().optional(),
})
export type DepartmentFormValues = z.infer<typeof departmentFormSchema>

export const designationFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  departmentId: z.string().optional(),
})
export type DesignationFormValues = z.infer<typeof designationFormSchema>

export const employmentTypeFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().optional(),
})
export type EmploymentTypeFormValues = z.infer<typeof employmentTypeFormSchema>

/**
 * What actually goes over the wire, which is not quite the form's own shape:
 *
 *  • `currentLevel` becomes null rather than "" — the backend column is an
 *    enum, and "" is not one of its values (nor is it nil).
 *  • the three permission-gated fields are optional, because the form OMITS
 *    them entirely for a user who may not set them. Sending them would earn a
 *    403 from EmployeePolicy; leaving the key out means "don't touch this",
 *    which is exactly what's meant.
 */
export interface EmployeePayload
  extends Omit<
    EmployeeFormValues,
    | "currentLevel"
    | "employmentTypeId"
    | "city"
    | "cityOther"
    | "primaryManagerId"
    | "secondaryManagerId"
    | "finalManagerId"
    | "projectManagerIds"
    | "additionalManagerIds"
    | "roleIds"
    | "workEmail"
    | "password"
    | "bankAccountNumber"
    | "bankAccountHolderName"
    | "bankIfscCode"
    | "aadhaarNumber"
    | "panNumber"
    | "otherIdentityNumbers"
  > {
  currentLevel?: EmployeeLevel | null
  employmentTypeId?: string | null
  // "Other" is resolved to the typed-in name before sending, so `cityOther`
  // never leaves the form; null is how a cleared city is expressed.
  city?: string | null
  // null clears the slot, a string sets it, and OMITTING the key leaves it
  // alone — which is how the form avoids touching the hierarchy for a viewer
  // who may not manage it.
  primaryManagerId?: string | null
  secondaryManagerId?: string | null
  finalManagerId?: string | null
  projectManagerIds?: string[]
  additionalManagerIds?: string[]
  roleIds?: string[]
  workEmail?: string
  // Omitted when blank, which leaves the server to generate one.
  password?: string
  /** Only sent from the employee page, never from the add/edit form. */
  requirePasswordChange?: boolean
  // Omitted when this viewer wasn't sent them (EmployeePolicy#view_sensitive_details?):
  // sending the form's blanks back would clear numbers they never saw.
  bankAccountNumber?: string
  bankAccountHolderName?: string
  bankIfscCode?: string
  aadhaarNumber?: string
  panNumber?: string
  otherIdentityNumbers?: IdentityNumberValues[]
}

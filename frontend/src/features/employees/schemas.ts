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

/**
 * An optional Indian mobile field. Shared by the employee's own number and by
 * their emergency contact's — the same rule with the same wording, because two
 * phone fields on one form that disagree about what a phone number is would be
 * a bug wherever the disagreement fell.
 */
const indianPhone = () =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || INDIAN_PHONE.test(v.replace(/[\s()-]/g, "")), {
      message: "Enter a valid Indian mobile number",
    })
    .optional()
    .or(z.literal(""))

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
}: {
  isNew: boolean
  /**
   * A getter, not a value: the domain is fetched, so it is usually not known
   * yet when the form builds this schema. Read at validation time instead.
   */
  workEmailDomain?: () => string | null
}) {
  return baseEmployeeFields
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

const baseEmployeeFields = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  employeeCode: z.string().trim().min(1, "Employee ID is required"),
  departmentId: z.string().optional(),
  /** The job title. Designation IS the job title — there is no second field. */
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
  workEmail: z.string().trim().email("Enter a valid work email").optional().or(z.literal("")),
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
  // Unconstrained in the base: the windows are added for a NEW employee only
  // — see buildEmployeeFormSchema.
  dateOfJoining: z.string().optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  gender: z.enum(GENDERS),
  phone: indianPhone(),
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
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: indianPhone(),
})

/** The add-employee rules. An edit uses buildEmployeeFormSchema({isNew:false}). */
export const employeeFormSchema = buildEmployeeFormSchema({ isNew: true })
export type EmployeeFormValues = z.infer<typeof baseEmployeeFields>

/**
 * What an employee may change about themselves from Profile → Edit my details
 * (PATCH /employees/:id/personal). Picked from the employee form's own fields
 * rather than restated, so a phone number, postal code or email is judged by
 * exactly the same rule — and the same sentence — on both screens.
 *
 * Unlike an HR edit, the 22-year floor is checked on every save here, not
 * only for a new hire: the panel's calendar stops at it too, and every record
 * added through the employee form already meets it. The server checks it
 * whenever the date actually changes.
 */
export const personalDetailsSchema = baseEmployeeFields
  .pick({
    dateOfBirth: true,
    gender: true,
    phone: true,
    personalEmail: true,
    addressLine1: true,
    addressLine2: true,
    city: true,
    cityOther: true,
    state: true,
    postalCode: true,
    country: true,
    emergencyContactName: true,
    emergencyContactPhone: true,
  })
  .superRefine((values, ctx) => {
    if (values.dateOfBirth && values.dateOfBirth > maxBirthDateIso()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateOfBirth"],
        message: `Employees must be at least ${MINIMUM_AGE_YEARS} years old`,
      })
    }
  })
export type PersonalDetailsValues = z.infer<typeof personalDetailsSchema>

/** As sent: "Other" resolved to the typed-in city, and null for a cleared one. */
export interface PersonalDetailsPayload extends Omit<PersonalDetailsValues, "city" | "cityOther"> {
  city?: string | null
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
}

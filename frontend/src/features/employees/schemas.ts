import { z } from "zod"

import type { EmployeeLevel } from "@/types/employees"

const EMPLOYEE_LEVEL_VALUES = ["intern", "junior", "senior", "lead", "manager"] as const

export const employeeFormSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  employeeCode: z.string().trim().min(1, "Employee ID is required"),
  departmentId: z.string().optional(),
  /** The job title. Designation IS the job title — there is no second field. */
  designationId: z.string().optional(),
  currentLevel: z.enum(EMPLOYEE_LEVEL_VALUES).optional().or(z.literal("")),
  employmentType: z.string().optional(),
  workLocation: z.string().optional(),
  // Employee → Primary Manager → (optional) Secondary Manager → Final Manager.
  // One field per typed slot, each an employee id or "" for unassigned. Not
  // required at the zod level even though a complete hierarchy carries Primary
  // and Final — see MANAGER_LEVELS in ./constants for why.
  primaryManagerId: z.string(),
  secondaryManagerId: z.string(),
  finalManagerId: z.string(),
  // §4's two further relationships. Outside the review chain, so neither is
  // subject to the "needs a primary first" rule below.
  departmentHeadId: z.string(),
  projectManagerIds: z.array(z.string()),
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
  dateOfJoining: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  phone: z.string().optional(),
  personalEmail: z.string().email("Enter a valid email address").optional().or(z.literal("")),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
})
  .refine((values) => values.roleIds.length === 0 || values.workEmail !== "", {
    // Mirrors Employees::AccountProvisioner::Error — caught here so it reads as
    // a field error on the email rather than a toast after a round trip.
    message: "A work email is needed before roles can be assigned",
    path: ["workEmail"],
  })
  .refine(
    (values) =>
      (values.secondaryManagerId === "" && values.finalManagerId === "") || values.primaryManagerId !== "",
    {
      // Mirrors Employee::ManagerHierarchyError. The Primary Manager anchors
      // the chain — neither of the other two slots can stand without it.
      message: "Assign a primary manager first",
      path: ["primaryManagerId"],
    }
  )
export type EmployeeFormValues = z.infer<typeof employeeFormSchema>

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
    | "primaryManagerId"
    | "secondaryManagerId"
    | "finalManagerId"
    | "departmentHeadId"
    | "projectManagerIds"
    | "roleIds"
    | "workEmail"
  > {
  currentLevel?: EmployeeLevel | null
  // null clears the slot, a string sets it, and OMITTING the key leaves it
  // alone — which is how the form avoids touching the hierarchy for a viewer
  // who may not manage it.
  primaryManagerId?: string | null
  secondaryManagerId?: string | null
  finalManagerId?: string | null
  departmentHeadId?: string | null
  projectManagerIds?: string[]
  roleIds?: string[]
  workEmail?: string
}

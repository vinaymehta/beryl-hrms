import { z } from "zod"

export const employeeFormSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  employeeCode: z.string().trim().min(1, "Employee code is required"),
  departmentId: z.string().optional(),
  designationId: z.string().optional(),
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

import { z } from "zod"

const email = z.string().trim().min(1, "Email is required").email("Enter a valid email address")
const password = z.string().min(8, "Password must be at least 8 characters")

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
})
export type LoginValues = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    companyName: z.string().trim().min(2, "Company name is required"),
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().min(1, "Last name is required"),
    email,
    password,
    passwordConfirmation: z.string().min(1, "Confirm your password"),
  })
  .refine((v) => v.password === v.passwordConfirmation, {
    message: "Passwords don't match",
    path: ["passwordConfirmation"],
  })
export type RegisterValues = z.infer<typeof registerSchema>

export const forgotPasswordSchema = z.object({ email })
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    password,
    passwordConfirmation: z.string().min(1, "Confirm your password"),
  })
  .refine((v) => v.password === v.passwordConfirmation, {
    message: "Passwords don't match",
    path: ["passwordConfirmation"],
  })
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

// Choosing a password from an invitation link is the same form as resetting
// one — same rules, same confirmation — so it shares the schema rather than
// growing a near-identical copy that could drift.
export const acceptInvitationSchema = resetPasswordSchema
export type AcceptInvitationValues = ResetPasswordValues

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    password,
    passwordConfirmation: z.string().min(1, "Confirm your new password"),
  })
  .refine((v) => v.password === v.passwordConfirmation, {
    message: "Passwords don't match",
    path: ["passwordConfirmation"],
  })
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>

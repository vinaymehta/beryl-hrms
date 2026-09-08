import { z } from "zod"

export const leaveRequestSchema = z
  .object({
    leaveType: z.string().trim().min(1, "Select a leave type"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    reason: z.string().trim().min(1, "A reason is required"),
  })
  .refine((v) => v.endDate >= v.startDate, { message: "End date can't be before start date", path: ["endDate"] })
export type LeaveRequestValues = z.infer<typeof leaveRequestSchema>

export type LeaveStatus = "pending" | "approved" | "rejected"

export interface LeaveRequest {
  id: string
  employeeName: string
  leaveType: string
  startDate: string
  endDate: string
  reason: string
  status: LeaveStatus
  reviewNote: string | null
  createdAt: string
}

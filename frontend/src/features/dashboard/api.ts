import { apiClient } from "@/lib/api-client"

export interface WeeklyAttendanceDay {
  day: string
  date: string
  present: number
}

export interface DashboardSummary {
  employeeCount: number
  departmentCount: number
  onLeaveToday: number
  pendingApprovals: number
  weeklyAttendance: WeeklyAttendanceDay[]
}

export const dashboardApi = {
  summary: () => apiClient.get<DashboardSummary>("/dashboard/summary"),
}

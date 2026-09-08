import { apiClient } from "@/lib/api-client"
import type { AttendanceRecord, TodayAttendance } from "@/types/attendance"

// GUESS: exact backend contract not confirmed against a live backend (built
// separately). `mine=true` scopes to the viewer's own record/history.
export const attendanceApi = {
  today: () => apiClient.get<TodayAttendance>("/attendance/today"),
  checkIn: () => apiClient.post<TodayAttendance>("/attendance/check_in", {}),
  checkOut: () => apiClient.patch<TodayAttendance>("/attendance/check_out", {}),
  list: (params: { from?: string; to?: string } = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v) as [string, string][]
    ).toString()
    return apiClient.get<AttendanceRecord[]>(`/attendance${query ? `?${query}` : ""}`)
  },
}

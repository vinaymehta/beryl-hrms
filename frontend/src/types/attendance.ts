export interface AttendanceRecord {
  id: string
  employeeName: string
  date: string
  checkInAt: string | null
  checkOutAt: string | null
  status: "present" | "absent" | "half_day"
}

export interface TodayAttendance {
  checkInAt: string | null
  checkOutAt: string | null
}

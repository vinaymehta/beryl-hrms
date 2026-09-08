"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { WeeklyAttendanceDay } from "@/features/dashboard/api"

interface AttendanceOverviewChartProps {
  data?: WeeklyAttendanceDay[]
}

export function AttendanceOverviewChart({ data }: AttendanceOverviewChartProps) {
  const chartData = data && data.length > 0 ? data : [
    { day: "Mon", present: 0 },
    { day: "Tue", present: 0 },
    { day: "Wed", present: 0 },
    { day: "Thu", present: 0 },
    { day: "Fri", present: 0 },
  ]

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} className="text-xs fill-muted-foreground" width={28} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const item = payload[0].payload as WeeklyAttendanceDay
            return (
              <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm">
                <p className="font-semibold">{item.day} {item.date ? `(${item.date})` : ""}</p>
                <p className="text-muted-foreground">Present: {item.present}</p>
              </div>
            )
          }}
        />
        <Bar dataKey="present" radius={[4, 4, 0, 0]} className="fill-role-hr" />
      </BarChart>
    </ResponsiveContainer>
  )
}

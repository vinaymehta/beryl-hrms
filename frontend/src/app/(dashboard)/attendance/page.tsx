"use client"

import { useState } from "react"
import { ClockIcon, LogInIcon, LogOutIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useTodayAttendance, useAttendanceHistory, useCheckInOut } from "@/features/attendance/hooks/use-attendance"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@/constants/permissions"

function fmtTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"
}

export default function AttendancePage() {
  const canManage = usePermission(PERMISSIONS.attendanceManage)
  const { data: today, isLoading: todayLoading } = useTodayAttendance()
  const { checkIn, checkOut } = useCheckInOut()
  const [range, setRange] = useState<{ from?: string; to?: string }>({})
  const { data: history, isLoading: historyLoading } = useAttendanceHistory(range)

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-role-hr/12 text-role-hr">
          <ClockIcon className="size-4.5" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today</CardTitle>
          <CardDescription>Check in when you start work, check out when you&apos;re done.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-6">
          {todayLoading ? (
            <Skeleton className="h-10 w-48" />
          ) : (
            <>
              <div className="flex gap-6 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Checked in</p>
                  <p className="font-medium">{fmtTime(today?.checkInAt ?? null)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Checked out</p>
                  <p className="font-medium">{fmtTime(today?.checkOutAt ?? null)}</p>
                </div>
              </div>
              {!today?.checkInAt ? (
                <Button disabled={checkIn.isPending} onClick={() => checkIn.mutate()}>
                  <LogInIcon /> Check in
                </Button>
              ) : !today?.checkOutAt ? (
                <Button variant="outline" disabled={checkOut.isPending} onClick={() => checkOut.mutate()}>
                  <LogOutIcon /> Check out
                </Button>
              ) : (
                <p className="text-sm text-success">Done for today.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Team attendance</CardTitle>
              <CardDescription>Filter by date range.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Input type="date" onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="w-40" />
              <Input type="date" onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="w-40" />
            </div>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : !history?.length ? (
              <p className="text-sm text-muted-foreground">No records for this range.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Check in</TableHead>
                      <TableHead>Check out</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.employeeName}</TableCell>
                        <TableCell>{r.date}</TableCell>
                        <TableCell>{fmtTime(r.checkInAt)}</TableCell>
                        <TableCell>{fmtTime(r.checkOutAt)}</TableCell>
                        <TableCell className="capitalize">{r.status.replace("_", " ")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

import { Badge } from "@/components/ui/badge"
import type { LeaveStatus } from "@/types/leave"

const CLASSES: Record<LeaveStatus, string> = {
  pending: "bg-warning/15 text-warning",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
}

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return <Badge className={CLASSES[status]}>{status[0].toUpperCase()}{status.slice(1)}</Badge>
}

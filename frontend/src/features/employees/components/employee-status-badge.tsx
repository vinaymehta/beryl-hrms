import { Badge } from "@/components/ui/badge"
import type { EmployeeStatus } from "@/types/employees"

const STATUS_CLASSES: Record<EmployeeStatus, string> = {
  active: "bg-success/15 text-success",
  inactive: "bg-warning/15 text-warning",
  offboarded: "bg-muted text-muted-foreground",
}

const STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  offboarded: "Offboarded",
}

export function EmployeeStatusBadge({
  status,
  className,
}: {
  status: EmployeeStatus
  /** Replaces the status colours — for the profile header, where green on the
      role-blue gradient all but disappears. */
  className?: string
}) {
  return <Badge className={className ?? STATUS_CLASSES[status]}>{STATUS_LABELS[status]}</Badge>
}

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

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  return <Badge className={STATUS_CLASSES[status]}>{STATUS_LABELS[status]}</Badge>
}

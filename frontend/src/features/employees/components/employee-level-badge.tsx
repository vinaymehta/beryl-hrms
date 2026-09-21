import { Badge } from "@/components/ui/badge"
import { EMPLOYEE_LEVELS } from "@/features/employees/constants"
import type { EmployeeLevel } from "@/types/employees"

/**
 * The career-level chip. Renders nothing at all when no level is recorded —
 * an "—" placeholder in a badge reads as a real value, and plenty of existing
 * employees legitimately have none.
 */
export function EmployeeLevelBadge({
  level,
  className,
}: {
  level: EmployeeLevel | null
  /** Replaces the level's own colours — for the profile header, where the
      ladder palette would sit on a coloured background and disappear. */
  className?: string
}) {
  const match = EMPLOYEE_LEVELS.find((option) => option.value === level)
  if (!match) return null

  return <Badge className={className ?? match.className}>{match.label}</Badge>
}

"use client"

import { Sheet, SheetContent } from "@/components/ui/sheet"
import { EmployeeDetailContent } from "./employee-detail-content"

interface EmployeeDetailPanelProps {
  employeeId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Right-side panel opened from the employee list — the list stays visible
 * behind it. Renders the same EmployeeDetailContent as the standalone
 * /employees/[id] route, so both stay in sync with zero duplication.
 */
export function EmployeeDetailPanel({ employeeId, open, onOpenChange }: EmployeeDetailPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:w-[45vw] sm:min-w-180 sm:max-w-275">
        {/* pt-12 clears the Sheet's absolutely-positioned close button, which
            would otherwise sit on top of the gradient header card. */}
        <div className="p-4 pt-12">{employeeId && <EmployeeDetailContent employeeId={employeeId} />}</div>
      </SheetContent>
    </Sheet>
  )
}

import { Building2Icon } from "lucide-react"

import { DepartmentDesignationManager } from "@/features/employees/components/department-designation-manager"

export const metadata = { title: "Departments" }

export default function DepartmentsPage() {
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-role-hr/12 text-role-hr">
          <Building2Icon className="size-4.5" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Departments</h1>
      </div>
      <DepartmentDesignationManager />
    </div>
  )
}

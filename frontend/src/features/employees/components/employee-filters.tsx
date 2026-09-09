"use client"

import { SearchIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDepartments } from "@/features/employees/hooks/use-employees"
import type { EmployeeListParams, EmployeeStatus } from "@/types/employees"

export function EmployeeFilters({
  params,
  onChange,
}: {
  params: EmployeeListParams
  onChange: (next: EmployeeListParams) => void
}) {
  const { data: departments } = useDepartments()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-48 flex-1">
        <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search employees…"
          defaultValue={params.q ?? ""}
          onChange={(e) => onChange({ ...params, q: e.target.value, page: 1 })}
        />
      </div>
      <Select
        value={params.departmentId ?? "all"}
        onValueChange={(v) => onChange({ ...params, departmentId: !v || v === "all" ? undefined : v, page: 1 })}
      >
        <SelectTrigger aria-label="Filter by department"><SelectValue placeholder="Department" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All departments</SelectItem>
          {departments?.map((d) => (
            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={params.status ?? "all"}
        onValueChange={(v) =>
          onChange({ ...params, status: !v || v === "all" ? undefined : (v as EmployeeStatus), page: 1 })
        }
      >
        <SelectTrigger aria-label="Filter by status"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
          <SelectItem value="offboarded">Offboarded</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

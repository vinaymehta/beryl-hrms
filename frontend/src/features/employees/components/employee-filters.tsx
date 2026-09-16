"use client"

import { SearchIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { FilterPopover } from "@/components/ui/filter-popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDepartments } from "@/features/employees/hooks/use-employees"
import type { EmployeeListParams, EmployeeStatus } from "@/types/employees"

const STATUS_OPTIONS: { value: EmployeeStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "offboarded", label: "Offboarded" },
]

export function EmployeeFilters({
  params,
  onChange,
}: {
  params: EmployeeListParams
  onChange: (next: EmployeeListParams) => void
}) {
  const { data: departments } = useDepartments()

  const activeFilterCount = (params.departmentId ? 1 : 0) + (params.status ? 1 : 0)

  function resetFilters() {
    onChange({ ...params, departmentId: undefined, status: undefined, page: 1 })
  }

  const departmentItems = [{ value: "all", label: "All departments" }, ...(departments?.map((d) => ({ value: d.id, label: d.name })) ?? [])]
  const statusItems = [{ value: "all", label: "All statuses" }, ...STATUS_OPTIONS]

  return (
    // Search + one compact Filter button, the same row Recruitment uses. The
    // department/status selects live inside the popover rather than in a
    // full-width strip that pushed the table down whenever it was open.
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-48 flex-1">
        <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-9 pl-8 text-xs"
          placeholder="Search employees…"
          defaultValue={params.q ?? ""}
          onChange={(e) => onChange({ ...params, q: e.target.value, page: 1 })}
        />
      </div>

      <FilterPopover
        activeCount={activeFilterCount}
        onReset={resetFilters}
        ariaLabel="Filter employees"
        accentClassName="border-role-hr text-role-hr bg-role-hr/5"
        badgeClassName="bg-role-hr text-role-hr-foreground"
      >
        <Select
          items={departmentItems}
          value={params.departmentId ?? "all"}
          onValueChange={(v) => onChange({ ...params, departmentId: !v || v === "all" ? undefined : v, page: 1 })}
        >
          <SelectTrigger aria-label="Filter by department" className="h-8 w-40 text-xs">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            {departmentItems.map((d) => (
              <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={statusItems}
          value={params.status ?? "all"}
          onValueChange={(v) =>
            onChange({ ...params, status: !v || v === "all" ? undefined : (v as EmployeeStatus), page: 1 })
          }
        >
          <SelectTrigger aria-label="Filter by status" className="h-8 w-40 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statusItems.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterPopover>
    </div>
  )
}

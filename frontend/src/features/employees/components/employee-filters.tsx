"use client"

import { SearchIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FilterPanel } from "@/components/ui/filter-panel"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDepartments } from "@/features/employees/hooks/use-employees"
import type { EmployeeListParams, EmployeeStatus } from "@/types/employees"

const STATUS_OPTIONS: { value: EmployeeStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "offboarded", label: "Offboarded" },
]

/**
 * Search stays on the toolbar; every other filter lives in the shared panel.
 *
 * Deliberately the same FilterPanel the recruitment lists use rather than a
 * second implementation of the same idea — the filter should be in the same
 * place, opened the same way, and look the same wherever you are.
 */
export function EmployeeFilters({
  params,
  onChange,
}: {
  params: EmployeeListParams
  onChange: (next: EmployeeListParams) => void
}) {
  const { data: departments } = useDepartments()

  const activeFilterCount = (params.departmentId ? 1 : 0) + (params.status ? 1 : 0)

  const departmentItems = [
    { value: "all", label: "All departments" },
    ...(departments?.map((d) => ({ value: d.id, label: d.name })) ?? []),
  ]
  const statusItems = [{ value: "all", label: "All statuses" }, ...STATUS_OPTIONS]

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-48 flex-1">
        <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-9 pl-8 text-xs"
          aria-label="Search employees"
          placeholder="Search employees…"
          defaultValue={params.q ?? ""}
          onChange={(e) => onChange({ ...params, q: e.target.value, page: 1 })}
        />
      </div>

      <FilterPanel
        activeCount={activeFilterCount}
        onReset={() =>
          onChange({ ...params, departmentId: undefined, status: undefined, page: 1 })
        }
        ariaLabel="Filter employees"
        title="Filter employees"
        accentClassName="border-role-hr text-role-hr bg-role-hr/5"
        badgeClassName="bg-role-hr text-role-hr-foreground"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="filter-department">Department</Label>
          <Select
            items={departmentItems}
            value={params.departmentId ?? "all"}
            onValueChange={(v) =>
              onChange({ ...params, departmentId: !v || v === "all" ? undefined : v, page: 1 })
            }
          >
            <SelectTrigger id="filter-department" aria-label="Filter by department" className="h-9 w-full">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              {departmentItems.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="filter-status">Status</Label>
          <Select
            items={statusItems}
            value={params.status ?? "all"}
            onValueChange={(v) =>
              onChange({ ...params, status: !v || v === "all" ? undefined : (v as EmployeeStatus), page: 1 })
            }
          >
            <SelectTrigger id="filter-status" aria-label="Filter by status" className="h-9 w-full">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statusItems.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FilterPanel>
    </div>
  )
}

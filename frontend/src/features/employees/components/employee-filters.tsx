"use client"

import { useState } from "react"
import { SearchIcon, FilterIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDepartments } from "@/features/employees/hooks/use-employees"
import type { EmployeeListParams, EmployeeStatus } from "@/types/employees"
import { cn } from "cn"

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
  const [showFilters, setShowFilters] = useState(false)

  const activeFilterCount = (params.departmentId ? 1 : 0) + (params.status ? 1 : 0)

  function resetFilters() {
    onChange({ ...params, departmentId: undefined, status: undefined, page: 1 })
  }

  const departmentItems = [{ value: "all", label: "All departments" }, ...(departments?.map((d) => ({ value: d.id, label: d.name })) ?? [])]
  const statusItems = [{ value: "all", label: "All statuses" }, ...STATUS_OPTIONS]

  return (
    <div className="space-y-3">
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

        <Button
          type="button"
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "relative gap-1.5 rounded-full",
            (showFilters || activeFilterCount > 0) && "border-role-hr text-role-hr bg-role-hr/5"
          )}
        >
          <FilterIcon className="size-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-role-hr text-[10px] font-bold text-role-hr-foreground">
              {activeFilterCount}
            </span>
          )}
        </Button>
        {activeFilterCount > 0 && (
          <Button type="button" variant="outline" onClick={resetFilters} className="rounded-full">
            Reset
          </Button>
        )}
      </div>

      {/* Always mounted (just visually hidden) — unmounting/remounting the
          Select components briefly shows their raw value instead of the
          matching option's label the first time they re-register. */}
      <div hidden={!showFilters} className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-3">
        <Select
          items={departmentItems}
          value={params.departmentId ?? "all"}
          onValueChange={(v) => onChange({ ...params, departmentId: !v || v === "all" ? undefined : v, page: 1 })}
        >
          <SelectTrigger aria-label="Filter by department" className="w-48"><SelectValue placeholder="Department" /></SelectTrigger>
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
          <SelectTrigger aria-label="Filter by status" className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            {statusItems.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

"use client"

import { SearchIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { FilterPanel } from "@/components/ui/filter-panel"
import { PanelOptionList, PanelSection } from "@/components/ui/panel"
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

  const departmentItems = departments?.map((d) => ({ value: String(d.id), label: d.name })) ?? []

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
        <PanelSection title="Department" flush>
          <PanelOptionList
            label="Department"
            options={departmentItems}
            value={params.departmentId}
            onChange={(departmentId) => onChange({ ...params, departmentId, page: 1 })}
          />
        </PanelSection>

        <PanelSection title="Status" flush>
          <PanelOptionList
            label="Status"
            options={STATUS_OPTIONS}
            value={params.status}
            onChange={(status) => onChange({ ...params, status, page: 1 })}
          />
        </PanelSection>
      </FilterPanel>
    </div>
  )
}

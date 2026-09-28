"use client"

import { TriangleAlertIcon } from "lucide-react"

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { MANAGER_LEVELS, ADDITIONAL_MANAGER_RELATIONSHIPS } from "@/features/employees/constants"
import { API_ORIGIN } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import type { Employee, EmployeeSummary } from "@/types/employees"

function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

/** "1st", "2nd", "3rd", "4th"… for the level labels. */
function ordinal(n: number) {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`
}

function photoUrl(path: string | null) {
  return path ? `${API_ORIGIN}${path}` : undefined
}

function ManagerRow({
  index,
  isLast,
  label,
  person,
}: {
  index: number
  isLast: boolean
  label: string
  person: EmployeeSummary
}) {
  return (
    <li className="relative grid gap-1.5 pl-9">
      <span
        aria-hidden
        className="absolute top-0 left-0 flex size-6 items-center justify-center rounded-full border bg-card text-[11px] font-semibold text-muted-foreground"
      >
        {index + 1}
      </span>
      {/* Reaches down through the list's own gap to meet the next node, so the
          three slots read as an order rather than as a plain list. */}
      {!isLast && (
        <span aria-hidden className="absolute top-6 bottom-[-0.875rem] left-3 w-px bg-border" />
      )}

      <span className="text-xs text-muted-foreground">{label}</span>

      <div className="flex items-center gap-2.5 rounded-lg border p-2.5">
        <Avatar size="sm">
          {person.profilePhotoUrl && (
            <AvatarImage src={photoUrl(person.profilePhotoUrl)} alt={person.fullName} />
          )}
          <AvatarFallback className="bg-role-hr/12 text-[10px] text-role-hr">
            {initialsOf(person.fullName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{person.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[person.designationTitle, person.departmentName].filter(Boolean).join(" · ") ||
              person.employeeCode}
          </p>
        </div>
      </div>
    </li>
  )
}

/**
 * Employee → Primary Manager → (optional) Secondary Manager → Final Manager,
 * then any further levels, read-only.
 *
 * Only the levels actually filled are shown — somebody with just a 1st level
 * manager sees one row, not a 1st plus two empty boxes. Each keeps its real
 * level number, so a gap in the chain still reads correctly.
 *
 * Shown to everyone who can see the employee, INCLUDING the employee
 * themselves — viewing the hierarchy is unrestricted; only changing it needs
 * employees.manage_reporting_managers, which is why there is no edit
 * affordance here.
 */
export function ManagerHierarchyCard({ employee }: { employee: Employee }) {
  const hierarchy = employee.managerHierarchy
  const chain = [
    ...MANAGER_LEVELS.map((level, index) => ({
      key: level.value,
      level: index + 1,
      label: level.label,
      person: hierarchy[level.value],
    })),
    ...hierarchy.additionalManagers.map((person, index) => ({
      key: `additional-${person.id}`,
      level: MANAGER_LEVELS.length + index + 1,
      label: `${ordinal(MANAGER_LEVELS.length + index + 1)} Level Manager`,
      person,
    })),
  ].filter((row): row is typeof row & { person: EmployeeSummary } => row.person != null)

  const relationships = ADDITIONAL_MANAGER_RELATIONSHIPS.map((relationship) => ({
    relationship,
    people: relationship.multiple
      ? hierarchy.projectManagers
      : ([hierarchy.departmentHead].filter(Boolean) as EmployeeSummary[]),
  })).filter(({ people }) => people.length > 0)

  return (
    <div className="grid gap-3">
      {!employee.managerHierarchyComplete && (
        <p className="flex items-start gap-1.5 rounded-lg bg-warning/10 px-2.5 py-2 text-xs text-warning">
          <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
          <span>This reporting line is incomplete — a 1st level manager is required.</span>
        </p>
      )}

      {chain.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reporting manager assigned.</p>
      ) : (
        <ol className="grid gap-3.5">
          {chain.map((row, index) => (
            <ManagerRow
              key={row.key}
              index={row.level - 1}
              isLast={index === chain.length - 1}
              label={row.label}
              person={row.person}
            />
          ))}
        </ol>
      )}

      {/* §4's two further relationships, rendered as their OWN group rather
          than as more rungs of the numbered chain — a Department Head is not a
          step in the review line, and is never the Final Reviewer by default. */}
      {relationships.length > 0 && (
        <div className="grid gap-2.5 border-t pt-3">
          <p className="text-xs font-semibold text-muted-foreground">
            Additional relationships — outside the review chain
          </p>

          {relationships.map(({ relationship, people }) => {
            return (
              <div key={relationship.value} className="grid gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">{relationship.label}</span>
                  {relationship.multiple && people.length > 0 && (
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] tabular-nums">
                      {people.length}
                    </Badge>
                  )}
                </div>

                {people.map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center gap-2.5 rounded-lg border p-2.5"
                  >
                    <Avatar size="sm">
                      {person.profilePhotoUrl && (
                        <AvatarImage src={photoUrl(person.profilePhotoUrl)} alt={person.fullName} />
                      )}
                      <AvatarFallback className="bg-role-hr/12 text-[10px] text-role-hr">
                        {initialsOf(person.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{person.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[person.designationTitle, person.departmentName]
                          .filter(Boolean)
                          .join(" · ") || person.employeeCode}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      <Badge
        variant="outline"
        className="h-auto w-fit py-1 text-[11px] font-normal whitespace-normal"
      >
        Manager assignments — not system roles
      </Badge>
    </div>
  )
}

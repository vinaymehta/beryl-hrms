"use client"

import { useState } from "react"
import { PlusIcon, PencilIcon, Trash2Icon, CheckCircle2Icon, LockIcon } from "lucide-react"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { RecordFormDialog } from "@/features/employees/components/record-form-dialog"
import { useEmployeeRecords, useEmployeeRecordMutations } from "@/features/employees/hooks/use-employee-records"
import { usePermission } from "@/features/auth/hooks/use-permission"
import type { RecordPanelSpec, ColumnSpec } from "@/features/employees/record-panels"
import type { EmployeeRecordRow } from "@/types/employee-records"

function humanise(value: string) {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
}

function renderCell(row: EmployeeRecordRow, column: ColumnSpec) {
  const raw = row[column.key]
  if (raw == null || raw === "") return <span className="text-muted-foreground">—</span>

  switch (column.kind) {
    case "date":
      return new Date(String(raw)).toLocaleDateString()
    case "enum":
      return <Badge variant="outline">{humanise(String(raw))}</Badge>
    case "percent":
      return <span className="tabular-nums">{Number(raw)}%</span>
    case "money":
      return <span className="tabular-nums">{Number(raw).toLocaleString()}</span>
    case "label":
      // Raw enum names (full_time) sit alongside free text (Senior Engineer)
      // in the same column, so this humanises without badging.
      return <span className="line-clamp-2">{humanise(String(raw))}</span>
    case "boolean":
      return raw ? (
        <Badge className="bg-success/15 text-success">Yes</Badge>
      ) : (
        <span className="text-muted-foreground">No</span>
      )
    default:
      return <span className="line-clamp-2">{String(raw)}</span>
  }
}

/**
 * One panel component for all seven employee record kinds, driven by its spec.
 *
 * Write actions appear only for a holder of the panel's permission — and for a
 * read-only panel (employment history, which the backend generates) they never
 * appear at all, because there is nothing to write.
 */
export function EmployeeRecordPanel({
  employeeId,
  spec,
}: {
  employeeId: string
  spec: RecordPanelSpec
}) {
  const canManage = usePermission(spec.permission)
  const { data, isLoading } = useEmployeeRecords(employeeId, spec.resource)
  const { save, remove, validateSkill } = useEmployeeRecordMutations(employeeId, spec.resource)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<EmployeeRecordRow | undefined>(undefined)

  const rows = data ?? []
  const writable = canManage && !spec.readOnly

  function openNew() {
    setEditing(undefined)
    setFormOpen(true)
  }

  if (isLoading) return <Skeleton className="h-40 w-full rounded-xl" />

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {rows.length} {rows.length === 1 ? "record" : "records"}
          {spec.readOnly && (
            <span className="ml-2 inline-flex items-center gap-1">
              <LockIcon className="size-3" /> recorded automatically
            </span>
          )}
        </p>
        {writable && (
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <PlusIcon className="size-3.5" /> Add
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
          {spec.emptyHint}
        </p>
      ) : (
        <div className="overflow-hidden overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {spec.columns.map((column) => (
                  <TableHead key={column.key}>{column.label}</TableHead>
                ))}
                {writable && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  {spec.columns.map((column) => (
                    <TableCell key={column.key} className="max-w-64 align-top text-sm">
                      {renderCell(row, column)}
                    </TableCell>
                  ))}
                  {writable && (
                    <TableCell className="align-top">
                      <div className="flex gap-0.5">
                        {spec.resource === "skills" && !row.validated && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Validate skill"
                            title="Validate"
                            disabled={validateSkill.isPending}
                            onClick={() => validateSkill.mutate(String(row.id))}
                          >
                            <CheckCircle2Icon className="size-4 text-success" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Edit record"
                          onClick={() => {
                            setEditing(row)
                            setFormOpen(true)
                          }}
                        >
                          <PencilIcon className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Remove record"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(String(row.id))}
                        >
                          <Trash2Icon className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {writable && (
        <RecordFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          title={spec.label}
          fields={spec.fields}
          record={editing}
          isPending={save.isPending}
          onSubmit={(values) =>
            save.mutate(
              { id: editing?.id ? String(editing.id) : undefined, values },
              { onSuccess: () => setFormOpen(false) }
            )
          }
        />
      )}
    </div>
  )
}

"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import type { FieldSpec } from "@/features/employees/record-panels"
import type { EmployeeRecordRow } from "@/types/employee-records"

/**
 * One form for every employee record kind, driven by the field spec in
 * record-panels.ts. Seven bespoke forms would be seven places for the same
 * validation and layout to drift.
 */
export function RecordFormDialog({
  open,
  onOpenChange,
  title,
  fields,
  record,
  isPending,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  fields: FieldSpec[]
  /** When given, the form edits that row; otherwise it creates. */
  record?: EmployeeRecordRow
  isPending: boolean
  onSubmit: (values: Record<string, string>) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <RecordFormBody
          key={record?.id ?? "new"}
          title={title}
          fields={fields}
          record={record}
          isPending={isPending}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  )
}

function RecordFormBody({
  title,
  fields,
  record,
  isPending,
  onSubmit,
  onCancel,
}: {
  title: string
  fields: FieldSpec[]
  record?: EmployeeRecordRow
  isPending: boolean
  onSubmit: (values: Record<string, string>) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map((field) => {
        const existing = record?.[field.key]
        return [field.key, existing == null ? "" : String(existing)]
      })
    )
  )

  const missingRequired = fields.some((field) => field.required && !values[field.key]?.trim())

  function set(key: string, value: string) {
    setValues((previous) => ({ ...previous, [key]: value }))
  }

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{record ? `Edit ${title.toLowerCase()}` : `Add ${title.toLowerCase()}`}</DialogTitle>
        <DialogDescription>Fields marked required must be filled in.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-3.5">
        {fields.map((field) => (
          <div key={field.key} className="grid gap-1.5">
            <Label htmlFor={`record-${field.key}`}>
              {field.label}
              {field.required && <span className="ml-1 text-destructive">*</span>}
            </Label>

            {field.type === "textarea" ? (
              <textarea
                id={`record-${field.key}`}
                rows={2}
                value={values[field.key] ?? ""}
                onChange={(event) => set(field.key, event.target.value)}
                className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
            ) : field.type === "select" ? (
              <Select
                items={field.options}
                value={values[field.key] || null}
                onValueChange={(next) => set(field.key, next ?? "")}
              >
                <SelectTrigger id={`record-${field.key}`} className="h-9 w-full">
                  <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={`record-${field.key}`}
                type={field.type}
                step={field.type === "number" ? "0.01" : undefined}
                value={values[field.key] ?? ""}
                onChange={(event) => set(field.key, event.target.value)}
              />
            )}
          </div>
        ))}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="bg-role-hr text-role-hr-foreground hover:bg-role-hr/90"
          disabled={isPending || missingRequired}
          onClick={() => onSubmit(values)}
        >
          {isPending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

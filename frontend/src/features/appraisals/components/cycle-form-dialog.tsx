"use client"

import { useState } from "react"
import { CalendarClockIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { MultiSelect } from "@/components/ui/multi-select"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import { REVIEW_TYPES } from "@/features/appraisals/constants"
import { useAppraisalTemplates } from "@/features/appraisals/hooks/use-appraisals"
import { useCreateAppraisalCycle, useUpdateAppraisalCycle } from "@/features/appraisals/hooks/use-appraisal-mutations"
import { useAssignableManagers } from "@/features/employees/hooks/use-employees"
import type { AppraisalCycleDetail } from "@/types/appraisals"

const EMPTY = {
  name: "",
  description: "",
  appraisalTemplateId: "",
  assessmentPeriodStart: "",
  assessmentPeriodEnd: "",
  startsOn: "",
  employeeSubmissionDeadline: "",
  primaryReviewDeadline: "",
  secondaryReviewDeadline: "",
  finalizationDeadline: "",
  compensationEffectiveDate: "",
}

/**
 * Create/edit an appraisal cycle. Nothing about a particular year is baked in —
 * the name, period, template and every deadline are the operator's to set.
 *
 * Eligibility is picked from the real employee directory and can only be
 * changed while the cycle is a draft; once it starts, the appraisals themselves
 * are the record of who is in it.
 */
function initialValues(cycle?: AppraisalCycleDetail) {
  if (!cycle) return { ...EMPTY }
  return {
    name: cycle.name ?? "",
    description: cycle.description ?? "",
    appraisalTemplateId: String(cycle.appraisalTemplateId ?? ""),
    assessmentPeriodStart: cycle.assessmentPeriodStart ?? "",
    assessmentPeriodEnd: cycle.assessmentPeriodEnd ?? "",
    startsOn: cycle.startsOn ?? "",
    employeeSubmissionDeadline: cycle.employeeSubmissionDeadline ?? "",
    primaryReviewDeadline: cycle.primaryReviewDeadline ?? "",
    secondaryReviewDeadline: cycle.secondaryReviewDeadline ?? "",
    finalizationDeadline: cycle.finalizationDeadline ?? "",
    compensationEffectiveDate: cycle.compensationEffectiveDate ?? "",
  }
}

/**
 * The body is a separate component so the parent can reset it with a `key`
 * rather than syncing props into state from an effect — the React-recommended
 * way to say "this is a different record now".
 */
function CycleForm({
  onOpenChange,
  cycle,
}: {
  onOpenChange: (open: boolean) => void
  cycle?: AppraisalCycleDetail
}) {
  const [values, setValues] = useState(() => initialValues(cycle))
  const [secondaryEnabled, setSecondaryEnabled] = useState(cycle?.secondaryReviewEnabled ?? false)
  const [reviewType, setReviewType] = useState(cycle?.reviewType ?? "annual")
  const [eligibleIds, setEligibleIds] = useState<string[]>(
    () => (cycle?.eligibleEmployees ?? []).map((employee) => String(employee.id))
  )
  const [employeeSearch, setEmployeeSearch] = useState("")
  const open = true

  const { data: templates } = useAppraisalTemplates("active", open)
  const { data: employees, isLoading: employeesLoading } = useAssignableManagers(employeeSearch, open)
  const createCycle = useCreateAppraisalCycle()
  const updateCycle = useUpdateAppraisalCycle(cycle?.id ?? "")
  const isEdit = Boolean(cycle)
  const locked = Boolean(cycle?.started)

  const employeeOptions = (employees?.data ?? []).map((employee) => ({
    value: String(employee.id),
    label: `${employee.firstName} ${employee.lastName}`.trim(),
    description: [employee.employeeCode, employee.designation?.title].filter(Boolean).join(" · "),
  }))

  function field(key: keyof typeof EMPTY, label: string, type = "text") {
    return (
      <div className="grid gap-1.5">
        <Label htmlFor={`cycle-${key}`}>{label}</Label>
        <Input
          id={`cycle-${key}`}
          type={type}
          value={values[key]}
          onChange={(event) => setValues((prev) => ({ ...prev, [key]: event.target.value }))}
        />
      </div>
    )
  }

  function handleSubmit() {
    const payload = {
      ...values,
      secondaryReviewEnabled: secondaryEnabled,
      reviewType,
      ...(locked ? {} : { eligibleEmployeeIds: eligibleIds }),
    }
    const mutation = isEdit ? updateCycle : createCycle
    mutation.mutate(payload, { onSuccess: () => onOpenChange(false) })
  }

  const isPending = createCycle.isPending || updateCycle.isPending

  return (
    <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:w-[45vw] sm:min-w-160 sm:max-w-240">
        <SheetHeader className="border-b bg-role-hr/5 pr-14">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-role-hr/12 text-role-hr">
              <CalendarClockIcon className="size-5" />
            </span>
            <div>
              <SheetTitle className="text-lg">{isEdit ? "Edit cycle" : "New appraisal cycle"}</SheetTitle>
              <SheetDescription>
                Name it, pick a template, set the deadlines, and choose who is in it.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Block layout, not `grid flex-1`. As a grid that is ALSO the flex-1
            scroll container this had a definite height, so its auto rows were
            compressed — and because each card sets `overflow-hidden`, their
            automatic minimum size resolves to 0 (min-height:auto only applies
            when overflow is visible), so nothing stopped them collapsing to the
            header. Every card rendered 40px tall once there were a few of them.
            `space-y-4` gives the same rhythm with content-sized children. */}
        <div className="flex-1 space-y-4 overflow-y-auto bg-muted/30 p-4">
          <section className="grid gap-3.5 rounded-xl border bg-card p-4 shadow-2xs">
            <h3 className="text-sm font-semibold">Cycle</h3>
            {field("name", "Name")}
            <div className="grid gap-1.5">
              <Label htmlFor="cycle-review-type">Review type</Label>
              <Select
                items={REVIEW_TYPES}
                value={reviewType}
                onValueChange={(next) => setReviewType(next ?? "annual")}
                disabled={locked}
              >
                <SelectTrigger id="cycle-review-type" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REVIEW_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cycle-template">Appraisal template</Label>
              <Select
                items={templates?.map((t) => ({ value: String(t.id), label: `${t.name} v${t.version}` }))}
                value={values.appraisalTemplateId || null}
                onValueChange={(next) =>
                  setValues((prev) => ({ ...prev, appraisalTemplateId: next ?? "" }))
                }
                disabled={locked}
              >
                <SelectTrigger id="cycle-template" className="h-9 w-full">
                  <SelectValue placeholder="Select an active template" />
                </SelectTrigger>
                <SelectContent>
                  {templates?.map((template) => (
                    <SelectItem key={template.id} value={String(template.id)}>
                      {template.name} v{template.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The template is frozen for this cycle once it starts, so later edits can&apos;t change historical
                appraisals.
              </p>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2">
              {field("assessmentPeriodStart", "Assessment period from", "date")}
              {field("assessmentPeriodEnd", "Assessment period to", "date")}
            </div>
          </section>

          <section className="grid gap-3.5 rounded-xl border bg-card p-4 shadow-2xs">
            <h3 className="text-sm font-semibold">Deadlines</h3>
            <div className="grid gap-3.5 sm:grid-cols-2">
              {field("startsOn", "Cycle starts", "date")}
              {field("employeeSubmissionDeadline", "Employee submission", "date")}
              {field("primaryReviewDeadline", "Primary review", "date")}
              {secondaryEnabled && field("secondaryReviewDeadline", "Secondary review", "date")}
              {field("finalizationDeadline", "Finalization", "date")}
              {field("compensationEffectiveDate", "Compensation effective", "date")}
            </div>
            <Label className="flex items-center gap-2 text-sm font-normal">
              <Checkbox checked={secondaryEnabled} onCheckedChange={(next) => setSecondaryEnabled(Boolean(next))} />
              Run a secondary manager review in this cycle
            </Label>
          </section>

          <section className="grid gap-2 rounded-xl border bg-card p-4 shadow-2xs">
            <h3 className="text-sm font-semibold">Eligible employees</h3>
            <MultiSelect
              options={employeeOptions}
              value={eligibleIds}
              onChange={setEligibleIds}
              onSearchChange={setEmployeeSearch}
              isLoading={employeesLoading}
              disabled={locked}
              placeholder="Select the employees in this cycle"
              searchPlaceholder="Search active employees…"
              emptyMessage="No active employees match that search."
              aria-label="Eligible employees"
            />
            <p className="text-xs text-muted-foreground">
              {locked
                ? "This cycle has started — eligibility is fixed."
                : "One appraisal is created per employee when the cycle starts. Anyone without a primary manager is reported back and skipped."}
            </p>
          </section>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t bg-background p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-role-hr text-role-hr-foreground shadow-2xs hover:bg-role-hr/90"
            disabled={isPending || !values.name || !values.appraisalTemplateId}
            onClick={handleSubmit}
          >
            {isPending ? "Saving…" : isEdit ? "Save cycle" : "Create cycle"}
          </Button>
        </div>
    </SheetContent>
  )
}

export function CycleFormDialog({
  open,
  onOpenChange,
  cycle,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cycle?: AppraisalCycleDetail
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Remounted whenever the target record changes, which resets every field
          without an effect that writes props into state. */}
      {open && <CycleForm key={cycle?.id ?? "new"} onOpenChange={onOpenChange} cycle={cycle} />}
    </Sheet>
  )
}

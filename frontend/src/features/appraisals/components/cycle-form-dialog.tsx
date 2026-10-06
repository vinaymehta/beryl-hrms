"use client"

import { useState } from "react"
import { CalendarClockIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PanelBody, PanelFooter, PanelHeader, PanelSection } from "@/components/ui/panel"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MultiSelect } from "@/components/ui/multi-select"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Sheet, SheetContent,
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
      reviewType,
      ...(locked ? {} : { eligibleEmployeeIds: eligibleIds }),
    }
    const mutation = isEdit ? updateCycle : createCycle
    mutation.mutate(payload, { onSuccess: () => onOpenChange(false) })
  }

  const isPending = createCycle.isPending || updateCycle.isPending

  return (
    <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:w-[45vw] sm:min-w-160 sm:max-w-240">
        <PanelHeader
          icon={CalendarClockIcon}
          title={isEdit ? "Edit cycle" : "New appraisal cycle"}
          description="Name it, pick a template, set the deadlines, and choose who is in it."
        />

        {/* PanelBody is block layout, not a grid — see the note there on why a
            grid scroll container collapses its cards. */}
        <PanelBody>
          <PanelSection title="Cycle">
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
          </PanelSection>

          <PanelSection title="Deadlines">
            <div className="grid gap-3.5 sm:grid-cols-2">
              {field("startsOn", "Cycle starts", "date")}
              {field("employeeSubmissionDeadline", "Employee submission", "date")}
              {field("primaryReviewDeadline", "Manager reviews", "date")}
              {field("finalizationDeadline", "Final review (Admin/HR)", "date")}
            </div>
            {/* No secondary switch: every manager level the employee has
                reviews in turn, and an empty level is skipped. */}
            <p className="text-xs text-muted-foreground">
              Each employee&apos;s appraisal goes to every one of their manager levels in order, then to
              Admin/HR for the final review.
            </p>
          </PanelSection>

          <PanelSection title="Eligible employees">
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
                : "One appraisal is created per employee when the cycle starts. It goes to each of their manager levels in turn, then to Admin/HR for the final review."}
            </p>
          </PanelSection>
        </PanelBody>

        <PanelFooter>
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
        </PanelFooter>
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

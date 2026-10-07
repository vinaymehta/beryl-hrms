"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PanelSection } from "@/components/ui/panel"
import { Skeleton } from "@/components/ui/skeleton"
import { InfoTip } from "@/components/ui/tooltip"
import {
  BREAKDOWN_ROWS,
  DEFAULT_SALARY_RULES,
  breakdownFromRules,
  inrNumber,
} from "@/features/appraisals/salary-structure"
import { companySettingsApi } from "@/features/employees/api"
import { COMPANY_SETTINGS_QUERY_KEY } from "./initial-id-settings"
import { errorMessage } from "@/lib/errors"
import type { SalaryStructureRules } from "@/types/appraisals"
import type { CompanySettings } from "@/types/employees"

type RuleKey = keyof SalaryStructureRules

/** The seven rules, in the order the letter's table lists the rows they fill. */
const RULE_FIELDS: { key: RuleKey; label: string; unit: "%" | "₹"; tip: string }[] = [
  {
    key: "basicPercentOfGross",
    label: "Basic",
    unit: "%",
    tip: "Percent of the monthly gross.",
  },
  {
    key: "hraPercentOfBasic",
    label: "House Rent Allowance",
    unit: "%",
    tip: "Percent of Basic.",
  },
  {
    key: "epfEmployeePercentOfBasic",
    label: "E.P.F. Employee",
    unit: "%",
    tip: "Percent of Basic. Shown in the table, not part of the monthly gross.",
  },
  {
    key: "conveyanceAmount",
    label: "Conveyance",
    unit: "₹",
    tip: "A fixed amount a month.",
  },
  {
    key: "incentiveAmount",
    label: "Incentive",
    unit: "₹",
    tip: "A fixed amount a month. Usually changed per employee on the Discussion step.",
  },
  {
    key: "othersAmount",
    label: "Others",
    unit: "₹",
    tip: "A fixed amount a month.",
  },
  {
    key: "epfEmployerPercentOfBasic",
    label: "E.P.F. Employer",
    unit: "%",
    tip: "Percent of Basic. Not part of the monthly gross, but added to it for the annual CTC.",
  },
]

/** The gross the example under the rules is worked out for — the reference letter's. */
const EXAMPLE_GROSS = 80000

type RuleValues = Record<RuleKey, string>

function rulesFrom(saved: SalaryStructureRules | null | undefined): RuleValues {
  const source = saved ?? DEFAULT_SALARY_RULES
  return Object.fromEntries(
    RULE_FIELDS.map((field) => [
      field.key,
      String(Number(source[field.key] ?? DEFAULT_SALARY_RULES[field.key])),
    ])
  ) as RuleValues
}

/** The typed values as numbers — what the server stores and the formula reads. */
function numericRules(values: RuleValues): SalaryStructureRules {
  const rules = { ...DEFAULT_SALARY_RULES }
  for (const field of RULE_FIELDS) rules[field.key] = Number(values[field.key])
  return rules
}

function ruleError(value: string, unit: "%" | "₹") {
  if (value.trim() === "") return "Required"
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return "Must be 0 or more"
  if (unit === "%" && n > 100) return "Must be 100 or less"
  return null
}

/**
 * Salary structure & letter: the legal name the appraisal letter is issued
 * for, and the company's rules for splitting a monthly gross into the letter's
 * compensation table. The Discussion step fills the table from these rules
 * whenever the new gross changes; Admin/HR can still edit any row there.
 */
export function SalaryLetterSettings() {
  const settings = useQuery({
    queryKey: COMPANY_SETTINGS_QUERY_KEY,
    queryFn: companySettingsApi.get,
  })

  if (settings.isPending) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }
  if (settings.isError) {
    return <p className="text-sm text-destructive">Couldn&apos;t load these settings.</p>
  }

  // Keyed on what was loaded, so a save re-seeds the form from the server.
  const d = settings.data
  return (
    <SalaryLetterForm
      key={`${d.legalName}|${JSON.stringify(d.salaryStructureRules ?? null)}`}
      data={d}
    />
  )
}

function SalaryLetterForm({ data }: { data: CompanySettings }) {
  const queryClient = useQueryClient()
  const initialRules = rulesFrom(data.salaryStructureRules)
  const initialName = data.legalName ?? data.companyName
  const [legalName, setLegalName] = useState(initialName)
  const [rules, setRules] = useState<RuleValues>(initialRules)

  const errors = Object.fromEntries(
    RULE_FIELDS.map((field) => [field.key, ruleError(rules[field.key], field.unit)])
  ) as Record<RuleKey, string | null>
  const valid = Object.values(errors).every((error) => error === null)
  const dirty =
    legalName.trim() !== initialName ||
    RULE_FIELDS.some((field) => Number(rules[field.key]) !== Number(initialRules[field.key]))

  const example = valid ? breakdownFromRules(EXAMPLE_GROSS, numericRules(rules)) : null

  const save = useMutation({
    mutationFn: () =>
      companySettingsApi.update({
        legalName: legalName.trim(),
        salaryStructureRules: numericRules(rules),
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(COMPANY_SETTINGS_QUERY_KEY, next)
      // An open Discussion re-fills its table from the rules it was sent.
      queryClient.invalidateQueries({ queryKey: ["appraisals"] })
      toast.success("Saved. New appraisal letters use these settings.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't save these settings.")),
  })

  return (
    <form
      className="grid max-w-3xl gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (dirty && valid) save.mutate()
      }}
    >
      <PanelSection title="Letter">
        <div className="grid max-w-md gap-1.5">
          <div className="flex items-center gap-1">
            <Label htmlFor="legal-name">Legal name</Label>
            <InfoTip label="Legal name">
              Printed as &ldquo;For &lt;legal name&gt;&rdquo; where the letter is signed off. Left
              blank, the company name is used.
            </InfoTip>
          </div>
          <Input
            id="legal-name"
            value={legalName}
            placeholder={data.companyName}
            disabled={save.isPending}
            onChange={(event) => setLegalName(event.target.value)}
          />
        </div>
      </PanelSection>

      <PanelSection
        title="Salary structure"
        action={
          <InfoTip label="Salary structure" side="left">
            Fills the letter&apos;s compensation table from the new monthly gross. Special Allowance
            has no rule: it is whatever the gross has left after the other earnings.
          </InfoTip>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RULE_FIELDS.map((field) => {
            const error = errors[field.key]
            return (
              <div key={field.key} className="grid content-start gap-1.5">
                <div className="flex items-center gap-1">
                  <Label htmlFor={`rule-${field.key}`}>{field.label}</Label>
                  <InfoTip label={field.label}>{field.tip}</InfoTip>
                </div>
                <div className="relative">
                  {field.unit === "₹" && (
                    <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                      ₹
                    </span>
                  )}
                  <Input
                    id={`rule-${field.key}`}
                    inputMode="decimal"
                    value={rules[field.key]}
                    disabled={save.isPending}
                    onChange={(event) =>
                      setRules((current) => ({
                        ...current,
                        [field.key]: event.target.value.replace(/[^\d.]/g, ""),
                      }))
                    }
                    aria-invalid={error !== null}
                    className={field.unit === "₹" ? "pl-6 tabular-nums" : "pr-7 tabular-nums"}
                  />
                  {field.unit === "%" && (
                    <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                      %
                    </span>
                  )}
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
            )
          })}
        </div>

        {example && (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              For a ₹{inrNumber.format(EXAMPLE_GROSS)} monthly gross:
            </span>{" "}
            {BREAKDOWN_ROWS.filter((row) => Number(example[row.key]) > 0)
              .map((row) => `${row.label} ${inrNumber.format(Number(example[row.key]))}`)
              .join(" · ")}
          </p>
        )}
      </PanelSection>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!dirty || !valid || save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
        {dirty && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={save.isPending}
            onClick={() => {
              setLegalName(initialName)
              setRules(initialRules)
            }}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}

import type { BreakdownKey, CompensationBreakdown, SalaryStructureRules } from "@/types/appraisals"

/**
 * The letter's COMPENSATION AND BENEFITS STRUCTURE table, row by row, in the
 * order the letter prints it. `earning` rows make up the monthly gross; the
 * two E.P.F. rows are listed but sit outside it.
 *
 * The same arithmetic runs on the server (Appraisals::SalaryStructure), which
 * is what the letter is generated from — this copy exists only so the table
 * can follow the gross live while Admin/HR type.
 */
export const BREAKDOWN_ROWS: { key: BreakdownKey; label: string; earning: boolean }[] = [
  { key: "basic", label: "Basic", earning: true },
  { key: "hra", label: "House Rent Allowance", earning: true },
  { key: "epfEmployee", label: "E.P.F. Employee", earning: false },
  { key: "conveyance", label: "Conveyance", earning: true },
  { key: "specialAllowance", label: "Special Allowance", earning: true },
  { key: "incentive", label: "Incentive", earning: true },
  { key: "others", label: "Others", earning: true },
  { key: "epfEmployer", label: "E.P.F. Employer", earning: false },
]

export const EARNING_KEYS = BREAKDOWN_ROWS.filter((row) => row.earning).map((row) => row.key)

/** The reference letter's numbers; the server holds the same defaults. */
export const DEFAULT_SALARY_RULES: SalaryStructureRules = {
  basicPercentOfGross: 50,
  hraPercentOfBasic: 50,
  conveyanceAmount: 1600,
  epfEmployeePercentOfBasic: 0,
  epfEmployerPercentOfBasic: 0,
  incentiveAmount: 0,
  othersAmount: 0,
}

export type BreakdownValues = Record<BreakdownKey, string>

export const EMPTY_BREAKDOWN = Object.fromEntries(
  BREAKDOWN_ROWS.map((row) => [row.key, ""])
) as BreakdownValues

const num = (value: string | number | null | undefined) => {
  const n = Number(value)
  return value === "" || value == null || !Number.isFinite(n) ? 0 : n
}

/**
 * Splits a monthly gross by the company's rules, to whole rupees. Special
 * allowance takes whatever is left and never goes below zero — when the fixed
 * rows already exceed the gross, the total shows the shortfall instead.
 */
export function breakdownFromRules(gross: number, rules: SalaryStructureRules): BreakdownValues {
  const basic = Math.round((gross * num(rules.basicPercentOfGross)) / 100)
  const hra = Math.round((basic * num(rules.hraPercentOfBasic)) / 100)
  const conveyance = Math.round(num(rules.conveyanceAmount))
  const incentive = Math.round(num(rules.incentiveAmount))
  const others = Math.round(num(rules.othersAmount))
  const values = {
    basic,
    hra,
    epfEmployee: Math.round((basic * num(rules.epfEmployeePercentOfBasic)) / 100),
    conveyance,
    specialAllowance: Math.max(
      0,
      Math.round(gross - (basic + hra + conveyance + incentive + others))
    ),
    incentive,
    others,
    epfEmployer: Math.round((basic * num(rules.epfEmployerPercentOfBasic)) / 100),
  }
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, String(value)])
  ) as BreakdownValues
}

/** A saved breakdown, as the strings the inputs hold. */
export function breakdownFromServer(saved: CompensationBreakdown): BreakdownValues {
  return Object.fromEntries(
    BREAKDOWN_ROWS.map((row) => [
      row.key,
      saved[row.key] == null ? "" : String(Number(saved[row.key])),
    ])
  ) as BreakdownValues
}

/** The earnings rows added up — what the letter calls the monthly gross. */
export function monthlyGross(breakdown: BreakdownValues) {
  return roundPaise(EARNING_KEYS.reduce((sum, key) => sum + num(breakdown[key]), 0))
}

/** (Monthly gross + E.P.F. Employer) × 12 — the annual CTC the letter states. */
export function annualCtc(breakdown: BreakdownValues) {
  return roundPaise((monthlyGross(breakdown) + num(breakdown.epfEmployer)) * 12)
}

export function roundPaise(value: number) {
  return Math.round(value * 100) / 100
}

/** Indian digit grouping, as the letter prints amounts: 4,80,000. */
export const inrNumber = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 })

export const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

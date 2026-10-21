/** Where a generated slip is: stored and reviewable, or emailed to the employee. */
export type SalarySlipStatus = "generated" | "sent"

/** A generated slip — the amounts are what its stored PDF printed. */
export interface SalarySlip {
  id: number
  status: SalarySlipStatus
  gross: number
  deductions: number
  net: number
  generatedAt: string
  sentAt: string | null
  sentTo: string | null
  /** The salary on file has changed since; regenerating would print new figures. */
  outdated: boolean
}

/** One row of a month's pay run (Api::V1::SalaryEmployeeSerializer). */
export interface SalaryEmployee {
  id: number
  employeeCode: string
  fullName: string
  designationTitle: string | null
  departmentName: string | null
  profilePhotoUrl: string | null
  salaryOnFile: boolean
  /** Work email, else personal; null when the employee has neither. */
  recipientEmail: string | null
  /** Blocking ones (see BLOCKING_ISSUES) first, then warnings. */
  issues: string[]
  /** No blocking issue: a slip can be generated and sent. */
  eligible: boolean
  /** What a slip would print from the salary on file today; null without one. */
  monthlyGross: number | null
  monthlyDeductions: number | null
  monthlyNet: number | null
  slip: SalarySlip | null
}

export interface SalaryRunSummary {
  /** Everyone in the run: active employees, plus anyone with a slip this month. */
  employees: number
  withSalary: number
  eligible: number
  generated: number
  sent: number
  /** Generated slips' own amounts, plus what the eligible rest would print. */
  totalGross: number
  totalDeductions: number
  totalNet: number
}

/** GET /salary/run?month=YYYY-MM */
export interface SalaryRun {
  /** YYYY-MM */
  month: string
  summary: SalaryRunSummary
  employees: SalaryEmployee[]
}

export interface SalaryGenerateResult {
  employeeId: number
  fullName: string
  status: "generated" | "skipped"
  reason: string | null
  slipId: number | null
}

/** POST /salary/slips/generate */
export interface SalaryGenerateBatch {
  month: string
  results: SalaryGenerateResult[]
  /** Set when sent slips were regenerated and so went back to Generated. */
  notice: string | null
}

export interface SalarySendResult {
  slipId: number
  employeeId: number
  fullName: string
  /** "queued" — the mail goes out from a background job moments later. */
  status: "queued" | "skipped"
  reason: string | null
  sentTo: string | null
}

/** POST /salary/slips/send */
export interface SalarySendBatch {
  results: SalarySendResult[]
}
